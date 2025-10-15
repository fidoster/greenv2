import { supabase } from "../lib/supabase";

interface ApiKeys {
  id?: string;
  user_id?: string;
  deepseek_key?: string;
  openai_key?: string;
  grok_key?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getActiveApiKey(service: 'deepseek' | 'openai' | 'grok' = 'openai'): Promise<string | null> {
  try {
    // Always use backend keys
    console.log(`Getting backend API key for ${service}`);


    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No authenticated user found');
      return null;
    }

    console.log('Fetching API keys for user:', user.id);
    
    // Get the backend API keys
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    const apiKeys = data as ApiKeys | null;

    if (error) {
      console.error('Error fetching API keys:', error);
      return null;
    }

    if (!apiKeys) {
      console.error('No API keys found for user');
      return null;
    }

    // Return the requested API key if available
    const backendKey = apiKeys[`${service}_key` as keyof ApiKeys];
    if (backendKey) {
      console.log(`Using backend ${service} key`);
      return backendKey as string;
    } else {
      console.error(`No ${service} key found in backend`);
    }

    return null;
  } catch (error) {
    console.error('Error getting API key:', error);
    return null;
  }
}

export async function sendChatMessage(messages: Array<{role: 'user' | 'assistant' | 'system', content: string}>) {
  try {
    // First try with OpenAI
    const openaiKey = await getActiveApiKey('openai');
    if (openaiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1-nano',
          messages,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch from OpenAI');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }

    // If OpenAI key is not available, try with DeepSeek
    const deepseekKey = await getActiveApiKey('deepseek');
    if (deepseekKey) {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepseekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages,
          temperature: 0.7,
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to fetch from DeepSeek');
      }

      const data = await response.json();
      return data.choices[0].message.content;
    }

    // If no API keys are available, return an error message
    throw new Error('No valid API key found. Please check your settings.');
  } catch (error) {
    console.error('Error in sendChatMessage:', error);
    throw error;
  }
}
