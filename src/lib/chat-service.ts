import { supabase } from "./supabase";
import { Message } from "../hooks/useChatState";
import { PersonaType } from "../components/PersonaSelector";
import { getPersonaDisplayName } from "../utils/personaUtils";

// Create a new conversation
export async function createConversation(title: string, persona: PersonaType) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      throw new Error("User not authenticated");
    }

    console.log(
      `Creating conversation with title: ${title}, persona: ${persona}, userId: ${userId}`,
    );

    const { data, error } = await supabase
      .from("conversations")
      .insert({
        title,
        persona: getPersonaDisplayName(persona),
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error in createConversation:", error);
      throw error;
    }

    console.log("Created conversation:", data);
    return data;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
}

// Save a message to a conversation
export async function saveMessage(conversationId: string, message: Message) {
  try {
    // Check if conversationId is valid (not 'default' and is a valid UUID)
    if (!conversationId || conversationId === 'default' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(conversationId)) {
      console.warn(`Invalid conversation ID: ${conversationId}. Skipping message save.`);
      return false;
    }

    console.log(`Saving message to conversation ${conversationId}:`, message);

    // Create a message object with required fields
    const messageData = {
      id: message.id,
      content: message.content,
      sender: message.sender,
      conversation_id: conversationId,
      created_at: message.timestamp.toISOString(),
      // Add role field for compatibility
      role: message.sender === 'user' ? 'user' : 'assistant',
    };

    // Only add the persona field if it exists in the message
    if (message.persona) {
      (messageData as any).persona = message.persona;
    }

    const { error } = await supabase.from("messages").insert(messageData);

    if (error) {
      console.error("Error in saveMessage:", error);
      throw error;
    }

    console.log("Message saved successfully");
    return true;
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
}

// Get a conversation with its messages
export async function getConversationWithMessages(conversationId: string) {
  try {
    console.log(`Getting conversation with ID: ${conversationId}`);

    // Get the conversation
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (conversationError) {
      console.error("Error fetching conversation:", conversationError);
      throw conversationError;
    }

    // Get the messages for this conversation
    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      throw messagesError;
    }

    console.log(
      `Found ${messagesData.length} messages for conversation ${conversationId}`,
    );

    // Format messages
    const messages = messagesData.map((msg) => ({
      id: msg.id,
      content: msg.content,
      sender: msg.sender as "user" | "bot",
      timestamp: new Date(msg.created_at),
      persona: msg.persona,
    }));

    return { ...conversation, messages };
  } catch (error) {
    console.error("Error getting conversation with messages:", error);
    throw error;
  }
}

// Get all conversations for the current user
export async function getConversations() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      console.log("No authenticated user found");
      return [];
    }

    console.log(`Getting conversations for user: ${userId}`);

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching conversations:", error);
      throw error;
    }

    console.log(`Found ${data.length} conversations`);
    return data;
  } catch (error) {
    console.error("Error getting conversations:", error);
    throw error;
  }
}

// Delete a conversation
export async function deleteConversation(conversationId: string) {
  try {
    // Delete all messages in the conversation first
    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId);

    if (messagesError) throw messagesError;

    // Then delete the conversation
    const { error: conversationError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);

    if (conversationError) throw conversationError;

    return true;
  } catch (error) {
    console.error("Error deleting conversation:", error);
    throw error;
  }
}

// Save API keys to the database
export async function saveApiKeys(keys: {
  deepseek?: string;
  openai?: string;
  grok?: string;
  service?: string;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) throw new Error("User not authenticated");

    // Check if user already has API keys
    const { data: existingKeys, error: fetchError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 means no rows found, which is fine
      console.error("Error fetching existing API keys:", fetchError);
      throw fetchError;
    }

    if (existingKeys) {
      // Update existing keys
      const updateData: any = {
        id: existingKeys.id,
        user_id: userId,
        deepseek_key: keys.deepseek || existingKeys.deepseek_key || "",
        openai_key: keys.openai || existingKeys.openai_key || "",
        grok_key: keys.grok || existingKeys.grok_key || "",
        service: keys.service || (existingKeys as any).service || "openai",
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("api_keys")
        .upsert(updateData);

      if (updateError) {
        console.error("Error updating API keys:", updateError);
        throw updateError;
      }
    } else {
      // Insert new keys
      const insertData = {
        user_id: userId,
        deepseek_key: keys.deepseek || "",
        openai_key: keys.openai || "",
        grok_key: keys.grok || "",
        service: keys.service || "openai",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase
        .from("api_keys")
        .insert(insertData);

      if (insertError) {
        console.error("Error inserting API keys:", insertError);
        throw insertError;
      }
    }

    return true;
  } catch (error) {
    console.error("Error saving API keys:", error);
    throw error;
  }
}

// Get API keys from the database
export async function getApiKeys() {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (!userId) {
      console.log("No authenticated user found for API keys");
      return null;
    }

    console.log(`Getting API keys for user: ${userId}`);

    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No keys found
        console.log("No API keys found for user");
        return null;
      }
      console.error("Error fetching API keys:", error);
      throw error;
    }

    console.log("API keys retrieved successfully");
    return {
      deepseek: data.deepseek_key || "",
      openai: data.openai_key || "",
      grok: data.grok_key || "",
    };
  } catch (error) {
    console.error("Error getting API keys:", error);
    return null;
  }
}
