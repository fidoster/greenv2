// Admin-only destructive operations on study data.
//
// Deleting a participant means erasing the auth user as well as their rows,
// and study_participants is deliberately service-role only (it holds the
// auth_secret that mints a participant session). Neither is reachable from
// the browser, so this runs server-side.
//
// Unlike study-auth, this function REQUIRES a caller JWT: deploy it WITHOUT
// --no-verify-jwt. The JWT alone is not enough, though -- any participant
// holds one. Admin status is re-checked here against public.users with the
// service role, because a client-side role check protects nobody.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PID_PATTERN = /^[0-9]{6}$/;
const PARTICIPANT_EMAIL_DOMAIN = "participants.greenbot.study";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error("study-admin is missing required environment configuration");
    return json({ error: "Study admin is not configured." }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // ---- Who is calling? ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Not signed in." }, 401);

    const { data: caller, error: callerError } = await admin.auth.getUser(token);
    if (callerError || !caller?.user) {
      return json({ error: "Not signed in." }, 401);
    }

    // ---- Are they actually an admin? ----
    // Read with the service role so this does not depend on the caller's own
    // RLS visibility, and so a participant cannot spoof a role by any route.
    const { data: roleRow, error: roleError } = await admin
      .from("users")
      .select("role")
      .eq("id", caller.user.id)
      .maybeSingle();

    if (roleError) {
      console.error("role lookup failed:", roleError.message);
      return json({ error: "Could not verify your access." }, 500);
    }

    if (roleRow?.role !== "admin") {
      // Deliberately the same shape as any other refusal: no hint about
      // whether the pid exists, and nothing that distinguishes "not an admin"
      // from "no such user".
      return json({ error: "Administrator access is required." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";
    const pid = typeof body.pid === "string" ? body.pid.trim() : "";

    if (action !== "deleteParticipant") {
      return json({ error: "Unknown action." }, 400);
    }

    if (!PID_PATTERN.test(pid)) {
      return json({ error: "Session code must be exactly 6 digits." }, 400);
    }

    // ---- Count first, so the UI can report what was actually removed ----
    const { count: messageCount } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("pid", pid);

    const { count: conversationCount } = await admin
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("pid", pid);

    // ---- Erase, narrowest scope first ----
    // Deleting the auth user would cascade to all of this, but the cascade
    // follows user_id. Deleting by pid as well means a row tagged with this
    // participant cannot survive on a technicality -- a conversation whose
    // owner drifted, say -- which is exactly what an erasure request must
    // not leave behind.
    const { error: msgError } = await admin
      .from("messages")
      .delete()
      .eq("pid", pid);
    if (msgError) {
      console.error("message delete failed:", msgError.message);
      return json({ error: "Could not delete this participant's messages." }, 500);
    }

    const { error: convError } = await admin
      .from("conversations")
      .delete()
      .eq("pid", pid);
    if (convError) {
      console.error("conversation delete failed:", convError.message);
      return json({ error: "Could not delete this participant's conversations." }, 500);
    }

    // The registry row carries the auth_secret and the scenario/consent
    // record. Read the user_id before removing it, since it is the only link
    // to the auth user.
    const { data: registry } = await admin
      .from("study_participants")
      .select("user_id")
      .eq("pid", pid)
      .maybeSingle();

    await admin.from("study_participants").delete().eq("pid", pid);

    // ---- Finally the auth user ----
    // Left behind, it would block the participant being recreated: study-auth
    // creates a user for an unknown pid, and createUser fails when the address
    // already exists. The email check is a guard against ever deleting a real
    // account through this endpoint, whatever the registry claims.
    let authUserDeleted = false;
    if (registry?.user_id) {
      const { data: target } = await admin.auth.admin.getUserById(
        registry.user_id,
      );
      const email = target?.user?.email ?? "";

      if (email === `${pid}@${PARTICIPANT_EMAIL_DOMAIN}`) {
        const { error: delError } = await admin.auth.admin.deleteUser(
          registry.user_id,
        );
        if (delError) {
          console.error("auth user delete failed:", delError.message);
        } else {
          authUserDeleted = true;
        }
      } else {
        console.error(
          `Refusing to delete auth user ${registry.user_id}: email ${email} is not participant ${pid}.`,
        );
      }
    }

    console.log(
      `Admin ${caller.user.id} deleted participant ${pid}: ${messageCount ?? 0} messages, ${conversationCount ?? 0} conversations, auth user ${authUserDeleted ? "removed" : "not removed"}.`,
    );

    return json({
      pid,
      messagesDeleted: messageCount ?? 0,
      conversationsDeleted: conversationCount ?? 0,
      authUserDeleted,
    });
  } catch (error) {
    console.error("study-admin unexpected error:", error);
    return json({ error: "Could not complete the deletion." }, 500);
  }
});
