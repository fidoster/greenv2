// Study mode authentication.
//
// Resolves a 6-digit participant ID to exactly one Supabase auth user and
// returns a session for it. Two entry paths converge here:
//
//   1. Qualtrics link:  /?pid=482913&scenario=1   (creates on first visit)
//   2. Return visit:    the participant types their ID at greenbot.live
//
// Because a pid IS the credential, this runs server-side with the service
// role so the mapping secret never reaches the browser, and every attempt is
// rate limited per client. Deploy with --no-verify-jwt: callers have no
// session yet, by definition.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// A 6-digit pid is only ~1e6 values, so throttle guessing hard.
const RATE_LIMIT_WINDOW_MINUTES = 15;
const RATE_LIMIT_MAX_FAILURES = 10;

const PID_PATTERN = /^[0-9]{6}$/;
// Synthetic, non-routable domain. The local part is the pid, so no personal
// data is introduced by giving each participant an auth user.
const PARTICIPANT_EMAIL_DOMAIN = "participants.greenbot.study";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function participantEmail(pid: string) {
  return `${pid}@${PARTICIPANT_EMAIL_DOMAIN}`;
}

function newSecret() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

// Hash the client IP with a server-side salt. The raw address is personal
// data under GDPR and is not needed -- we only ever compare hashes.
async function hashIp(ip: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("study-auth is missing required environment configuration");
    return json({ error: "Study mode is not configured." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await req.json().catch(() => ({}));
    const pid = typeof body.pid === "string" ? body.pid.trim() : "";
    const scenarioRaw = body.scenario;

    // ---- Validate the pid server-side. Never trust the client's check. ----
    if (!PID_PATTERN.test(pid)) {
      return json({ error: "Participant ID must be exactly 6 digits." }, 400);
    }

    // ---- Rate limit before doing any lookup ----
    const forwardedFor = req.headers.get("x-forwarded-for") ?? "";
    const clientIp = forwardedFor.split(",")[0].trim() || "unknown";
    const ipHash = await hashIp(
      clientIp,
      Deno.env.get("STUDY_IP_SALT") ?? serviceRoleKey,
    );

    const windowStart = new Date(
      Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    ).toISOString();

    const { count: recentFailures } = await admin
      .from("study_auth_attempts")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .eq("succeeded", false)
      .gte("attempted_at", windowStart);

    if ((recentFailures ?? 0) >= RATE_LIMIT_MAX_FAILURES) {
      return json(
        { error: "Too many attempts. Please wait a few minutes and try again." },
        429,
      );
    }

    const recordAttempt = async (succeeded: boolean) => {
      await admin
        .from("study_auth_attempts")
        .insert({ ip_hash: ipHash, succeeded });
    };

    // ---- Look up the participant ----
    const { data: existing, error: lookupError } = await admin
      .from("study_participants")
      .select("pid, scenario, user_id, auth_secret")
      .eq("pid", pid)
      .maybeSingle();

    if (lookupError) {
      console.error("study_participants lookup failed:", lookupError.message);
      return json({ error: "Could not start your study session." }, 500);
    }

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ---- Returning participant ----
    if (existing) {
      let secret = existing.auth_secret;

      let { data: signIn, error: signInError } =
        await publicClient.auth.signInWithPassword({
          email: participantEmail(pid),
          password: secret,
        });

      // Self-heal if the stored secret has drifted from the auth user.
      if (signInError || !signIn?.session) {
        secret = newSecret();
        const { error: resetError } = await admin.auth.admin.updateUserById(
          existing.user_id,
          { password: secret },
        );

        if (resetError) {
          console.error("Password reset failed:", resetError.message);
          await recordAttempt(false);
          return json({ error: "Could not start your study session." }, 500);
        }

        await admin
          .from("study_participants")
          .update({ auth_secret: secret })
          .eq("pid", pid);

        ({ data: signIn, error: signInError } =
          await publicClient.auth.signInWithPassword({
            email: participantEmail(pid),
            password: secret,
          }));

        if (signInError || !signIn?.session) {
          console.error("Sign-in failed after reset:", signInError?.message);
          await recordAttempt(false);
          return json({ error: "Could not start your study session." }, 500);
        }
      }

      await admin
        .from("study_participants")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("pid", pid);

      await recordAttempt(true);

      return json({
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
        pid,
        // The scenario recorded at first entry wins, so a participant
        // returning without URL parameters keeps their original assignment.
        scenario: existing.scenario,
        returning: true,
      });
    }

    // ---- First visit: requires a scenario from the Qualtrics link ----
    const scenario = Number(scenarioRaw);
    if (scenario !== 1 && scenario !== 2) {
      // Reached when someone types an unknown ID at the login form. We do not
      // create participants here, so guessing IDs cannot mint new accounts.
      await recordAttempt(false);
      return json(
        {
          error:
            "No study session found for that participant ID. Please use the link from the questionnaire to begin.",
          unknownPid: true,
        },
        404,
      );
    }

    const secret = newSecret();
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: participantEmail(pid),
        password: secret,
        email_confirm: true,
        user_metadata: { study_pid: pid, study_scenario: scenario },
      });

    if (createError || !created?.user) {
      console.error("createUser failed:", createError?.message);
      await recordAttempt(false);
      return json({ error: "Could not start your study session." }, 500);
    }

    const { error: insertError } = await admin
      .from("study_participants")
      .insert({
        pid,
        scenario,
        user_id: created.user.id,
        auth_secret: secret,
      });

    if (insertError) {
      // Roll back the orphaned auth user so a retry can succeed cleanly.
      await admin.auth.admin.deleteUser(created.user.id);
      console.error("study_participants insert failed:", insertError.message);
      await recordAttempt(false);
      return json({ error: "Could not start your study session." }, 500);
    }

    const { data: signIn, error: signInError } =
      await publicClient.auth.signInWithPassword({
        email: participantEmail(pid),
        password: secret,
      });

    if (signInError || !signIn?.session) {
      console.error("Sign-in failed for new participant:", signInError?.message);
      await recordAttempt(false);
      return json({ error: "Could not start your study session." }, 500);
    }

    await recordAttempt(true);

    // Best-effort housekeeping so the attempt log does not grow without bound.
    await admin
      .from("study_auth_attempts")
      .delete()
      .lt(
        "attempted_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      );

    return json({
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
      pid,
      scenario,
      returning: false,
    });
  } catch (error) {
    console.error("study-auth unexpected error:", error);
    return json({ error: "Could not start your study session." }, 500);
  }
});
