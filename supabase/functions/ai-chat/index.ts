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

    if (apiKeysError) {
      console.error("Error fetching API keys:", apiKeysError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch API keys from database." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!apiKeysData) {
      return new Response(
        JSON.stringify({
          error: "No API keys configured. Please add your API keys at /admin",
          needsSetup: true
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get the appropriate API key based on provider
    let apiKey: string | null = null;
    let apiUrl: string;
    let model: string;

    switch (provider) {
      case "openai":
        apiKey = apiKeysData.openai_key;
        apiUrl = "https://api.openai.com/v1/chat/completions";
        model = "gpt-4o";
        break;
      case "deepseek":
        apiKey = apiKeysData.deepseek_key;
        apiUrl = "https://api.deepseek.com/v1/chat/completions";
        model = "deepseek-chat";
        break;
      case "grok":
        apiKey = apiKeysData.grok_key;
        apiUrl = "https://api.x.ai/v1/chat/completions";
        model = "grok-beta";
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
      return new Response(
        JSON.stringify({ error: `No ${provider.toUpperCase()} API key found. Please add it in settings.` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Call the AI API
    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
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
