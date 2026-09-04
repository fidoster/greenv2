// Supabase Edge Function to proxy AI API requests
// This avoids CORS issues when calling AI APIs from the browser

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get request body
    const { messages, provider = "openai" } = await req.json();

    // Get Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Get the authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API keys from database
    const { data: apiKeysData, error: apiKeysError } = await supabaseClient
      .from("api_keys")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // A missing row is not an error: study participants and guests never
    // configure their own keys and fall back to the deployment key below.
    if (apiKeysError) {
      console.error("Error fetching API keys:", apiKeysError);
    }

    // ---- Provider configuration ----------------------------------------
    // Deployment-wide keys are set with:
    //   supabase secrets set OPENAI_API_KEY=... GROK_API_KEY=...
    // They keep keys out of the database and let users who own no api_keys
    // row -- study participants above all -- still get responses.
    interface ProviderConfig {
      name: string;
      apiKey: string | null;
      apiUrl: string;
      model: string;
    }

    const resolveProvider = (name: string): ProviderConfig | null => {
      let apiKey: string | null;
      let apiUrl: string;
      let model: string;
      let envVar: string;

      switch (name) {
        case "openai":
          apiKey = apiKeysData?.openai_key ?? null;
          apiUrl = "https://api.openai.com/v1/chat/completions";
          // GPT-5.6 Luna: low-tier model, price cut 80% in July 2026
          // ($0.20/M in, $1.20/M out vs gpt-4o's $2.50/$10).
          model = "gpt-5.6-luna";
          envVar = "OPENAI_API_KEY";
          break;
        case "deepseek":
          apiKey = apiKeysData?.deepseek_key ?? null;
          apiUrl = "https://api.deepseek.com/v1/chat/completions";
          model = "deepseek-chat";
          envVar = "DEEPSEEK_API_KEY";
          break;
        case "grok":
          apiKey = apiKeysData?.grok_key ?? null;
          apiUrl = "https://api.x.ai/v1/chat/completions";
          // grok-4.1-fast: xAI's cheapest, $0.20/M in and $0.50/M out --
          // same input price as Luna and cheaper output.
          model = "grok-4.1-fast";
          envVar = "GROK_API_KEY";
          break;
        default:
          return null;
      }

      if (!apiKey) apiKey = Deno.env.get(envVar) ?? null;
      return { name, apiKey, apiUrl, model };
    };

    const primary = resolveProvider(provider);
    if (!primary) {
      return new Response(
        JSON.stringify({ error: `Unknown provider: ${provider}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Grok backs up OpenAI when OpenAI is rate limited or down. Participants
    // arrive in cohorts and all hit the API at once, so a single provider is
    // a single point of failure for the whole session.
    const chain: ProviderConfig[] = [primary];
    if (provider === "openai") {
      const backup = resolveProvider("grok");
      if (backup?.apiKey) chain.push(backup);
    }

    if (!chain.some((c) => c.apiKey)) {
      return new Response(
        JSON.stringify({
          error: `No ${provider.toUpperCase()} API key found. Please add it in settings.`,
          needsSetup: true,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Only capacity and outage failures are worth retrying elsewhere. A 400
    // or 401 means our request or our key is wrong, and silently answering
    // from another model would hide that -- which for a study would quietly
    // mix two models into one dataset.
    const isRetryable = (status: number) =>
      status === 408 || status === 409 || status === 429 || status >= 500;

    const buildBody = (model: string) => {
      // The GPT-5 family rejects max_tokens outright and accepts no
      // temperature other than the default. DeepSeek and Grok still expect
      // the old pair, so the body is built per-model.
      const body: Record<string, unknown> = { model, messages };
      if (model.startsWith("gpt-5")) {
        // Headroom above the previous 1000: reasoning tokens come out of the
        // same budget, and exhausting it returns an empty message, not an error.
        body.max_completion_tokens = 2000;
      } else {
        body.temperature = 0.7;
        body.max_tokens = 1000;
      }
      return body;
    };

    let lastError = "No provider was reachable.";
    let lastStatus = 502;

    for (let i = 0; i < chain.length; i++) {
      const cfg = chain[i];
      const isLast = i === chain.length - 1;

      if (!cfg.apiKey) {
        lastError = `No ${cfg.name.toUpperCase()} API key configured.`;
        lastStatus = 400;
        continue;
      }

      try {
        const aiResponse = await fetch(cfg.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify(buildBody(cfg.model)),
        });

        if (aiResponse.ok) {
          const data = await aiResponse.json();
          if (i > 0) {
            console.log(
              `Primary ${chain[0].name} failed; answered with ${cfg.name} (${cfg.model})`
            );
          }
          // data.model tells the client which model actually replied, so a
          // failover is recorded rather than silently blended into the data.
          return new Response(
            JSON.stringify({ ...data, model: data.model ?? cfg.model }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const errorText = await aiResponse.text();
        lastError = `${cfg.name.toUpperCase()} API error: ${aiResponse.status} ${errorText}`;
        lastStatus = aiResponse.status;
        console.error(lastError);

        if (!isRetryable(aiResponse.status) || isLast) break;
        console.log(`${cfg.name} returned ${aiResponse.status}; trying backup`);
      } catch (fetchError) {
        lastError = `${cfg.name.toUpperCase()} request failed: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`;
        lastStatus = 502;
        console.error(lastError);
        if (isLast) break;
        console.log(`${cfg.name} unreachable; trying backup`);
      }
    }

    return new Response(JSON.stringify({ error: lastError }), {
      status: lastStatus,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
