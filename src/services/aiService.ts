import { supabase } from "../lib/supabase";

/**
 * SECURITY: This service uses Supabase Edge Functions to securely call AI APIs
 * API keys are NEVER exposed to the client/browser
 * Keys are retrieved server-side by the Edge Function from the database
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface EdgeFunctionResponse {
  choices?: Array<{
    message: {
      content: string;
    };
  }>;
  error?: string;
  needsSetup?: boolean;
}

/**
 * Send a chat message through the secure Edge Function
 * @param messages - Array of chat messages
 * @param provider - AI provider to use ('openai', 'deepseek', or 'grok')
 * @returns AI response text
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  provider: 'openai' | 'deepseek' | 'grok' = 'openai'
): Promise<string> {
  try {
    console.log(`[AI Service] Calling Edge Function with provider: ${provider}`);

    // Get the current session for authentication
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      throw new Error('You must be logged in to use the chat. Please sign in.');
    }

    // Call the Edge Function which securely retrieves API keys from database
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        messages,
        provider
      },
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    });

    if (error) {
      console.error('[AI Service] Edge Function error:', error);
      throw new Error(error.message || 'Failed to connect to AI service');
    }

    const response = data as EdgeFunctionResponse;

    // Handle specific error cases
    if (response.error) {
      if (response.needsSetup) {
        throw new Error('No API keys configured. Please add your API keys in Settings (/admin).');
      }
      throw new Error(response.error);
    }

    // Extract the AI response
    if (response.choices && response.choices.length > 0) {
      const aiResponse = response.choices[0].message.content;
      console.log('[AI Service] Successfully received AI response');
      return aiResponse;
    }

    throw new Error('Invalid response format from AI service');

  } catch (error) {
    console.error('[AI Service] Error in sendChatMessage:', error);

    // Provide helpful error messages
    if (error instanceof Error) {
      // Handle specific error cases
      if (error.message.includes('No API keys configured')) {
        throw new Error('No API keys configured. Please add your API keys at /admin');
      }

      if (error.message.includes('Unauthorized')) {
        throw new Error('Session expired. Please sign in again.');
      }

      if (error.message.includes('rate limit')) {
        throw new Error('You\'ve hit the rate limit. Please try again in a few minutes.');
      }

      if (error.message.includes('insufficient_quota') || error.message.includes('402')) {
        throw new Error('Your API account has insufficient credits. Please add credits to your API provider account.');
      }

      throw error;
    }

    throw new Error('Failed to communicate with AI service. Please try again.');
  }
}

/**
 * Test API connection by sending a simple message
 * @param provider - AI provider to test
 * @returns Success message or throws error
 */
export async function testApiConnection(
  provider: 'openai' | 'deepseek' | 'grok' = 'openai'
): Promise<string> {
  try {
    const testMessages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Respond with just "OK" to test the connection.'
      },
      {
        role: 'user',
        content: 'Test connection'
      }
    ];

    const response = await sendChatMessage(testMessages, provider);

    if (response) {
      return `✓ ${provider.toUpperCase()} API connection successful!`;
    }

    throw new Error('No response received');
  } catch (error) {
    console.error(`[AI Service] ${provider} API test failed:`, error);
    throw error;
  }
}
