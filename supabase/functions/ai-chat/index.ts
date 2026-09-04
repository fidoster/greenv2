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

    // Get the appropriate API key based on provider
    let apiKey: string | null = null;
    let apiUrl: string;
    let model: string;
    // Deployment-wide fallback, set with:
    //   supabase secrets set OPENAI_API_KEY=...
    // Keeps the key out of the database entirely and lets users who own no
    // api_keys row -- study participants above all -- still get responses.
    let fallbackEnvVar: string;

    switch (provider) {
      case "openai":
        apiKey = apiKeysData?.openai_key ?? null;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        // GPT-5.6 Luna: the low-tier model whose price dropped 80% in July
        // 2026 ($0.20/M in, $1.20/M out vs gpt-4o's $2.50/$10).
        model = "gpt-5.6-luna";
        fallbackEnvVar = "OPENAI_API_KEY";
        break;
      case "deepseek":
        apiKey = apiKeysData?.deepseek_key ?? null;
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        fallbackEnvVar = "DEEPSEEK_API_KEY";
        break;
      case "grok":
        apiKey = apiKeysData?.grok_key ?? null;
        apiUrl = "https://api.x.ai/v1/chat/completions";
        model = "grok-beta";
        fallbackEnvVar = "GROK_API_KEY";
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Unknown provider: ${provider}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    if (!apiKey) {
      apiKey = Deno.env.get(fallbackEnvVar) ?? null;
      if (apiKey) {
        console.log(`Using deployment ${provider} key for user ${user.id}`);
      }
    }

    if (!apiKey) {
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

    // The GPT-5 family rejects both max_tokens and any temperature other than
    // the default, with a 400. DeepSeek and Grok still expect the old pair, so
    // the body is built per-model rather than shared.
    const isGpt5Family = model.startsWith("gpt-5");

    const requestBody: Record<string, unknown> = {
      model: model,
      messages: messages,
    };

    if (isGpt5Family) {
      // Headroom above the previous 1000: on these models any reasoning
      // tokens are drawn from the same budget, and exhausting it returns an
      // empty message rather than an error.
      requestBody.max_completion_tokens = 2000;
    } else {
      requestBody.temperature = 0.7;
      requestBody.max_tokens = 1000;
    }

    // Call the AI API
    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!aiResponse.ok) {
      const errorData = await aiResponse.text();
      return new Response(
        JSON.stringify({
          error: `${provider.toUpperCase()} API error: ${aiResponse.status} ${errorData}`,
        }),
        {
          status: aiResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await aiResponse.json();

    return new Response(JSON.stringify(data), {
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
