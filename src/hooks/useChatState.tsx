import { useState, useEffect } from "react";
import { PersonaType } from "../components/PersonaSelector";
import { supabase } from "../lib/supabase";
import {
  createConversation,
  saveMessage,
  getConversationWithMessages,
  getConversations,
} from "../lib/chat-service";
import {
  getPersonaDisplayName,
  getPersonaWelcomeMessage,
} from "../utils/personaUtils";
import {
  filterDeletedChats,
  generateTitleFromContent,
  updateUnauthenticatedChats,
} from "../utils/storageUtils";

// Types
export interface Message {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  persona?:
    | "GreenBot"
    | "EcoLife Guide"
    | "Waste Wizard"
    | "Nature Navigator"
    | "Power Sage"
    | "Climate Guardian";
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  selected?: boolean;
}

// Custom hook for managing chat state
export function useChatState(initialPersona: PersonaType = "greenbot") {
  // State definitions
  const [currentPersona, setCurrentPersona] =
    useState<PersonaType>(initialPersona);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Hello! I'm GreenBot, your sustainable AI assistant. How can I help you with environmental topics today?",
      sender: "bot",
      timestamp: new Date(Date.now() - 60000),
      persona: "GreenBot",
    },
  ]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isQuizOpen, setIsQuizOpen] = useState(false);

  // Authentication and initial data loading
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        // Check if user is authenticated
        const { data } = await supabase.auth.getSession();
        const isAuthed = !!data.session;
        setIsAuthenticated(isAuthed);

        // Load conversations or initialize new user
        if (!isAuthed) {
          // For unauthenticated users, load chats from localStorage
          try {
            const storedChats = localStorage.getItem("unauthenticatedChats");
            if (storedChats) {
              const parsedChats = JSON.parse(storedChats);
              const filteredChats = filterDeletedChats(parsedChats);
              setChatHistory(
                filteredChats.map((chat) => ({
                  ...chat,
                  selected: false,
                })),
              );
            }
          } catch (error) {
            console.error("Error loading unauthenticated chats:", error);
          }
        }
      } catch (error) {
        console.error("Error in authentication check:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // Auth state listener setup
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event) => {
        // Handle sign in/out events
        if (event === "SIGNED_OUT") {
          // Load unauthenticated chats when signed out
          try {
            const storedChats = localStorage.getItem("unauthenticatedChats");
            if (storedChats) {
              const parsedChats = JSON.parse(storedChats);
              const filteredChats = filterDeletedChats(parsedChats);
              setChatHistory(
                filteredChats.map((chat) => ({
                  ...chat,
                  selected: false,
                })),
              );
            }
          } catch (error) {
            console.error("Error loading unauthenticated chats:", error);
          }
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Update conversation title in Supabase
  const updateConversationTitle = async (
    conversationId: string,
    title: string,
  ) => {
    try {
      await supabase
        .from("conversations")
        .update({ title })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error updating conversation title:", error);
    }
  };

  // Update conversation persona in Supabase
  const updateConversationPersona = async (
    conversationId: string,
    persona: PersonaType,
  ) => {
    try {
      await supabase
        .from("conversations")
        .update({ persona: getPersonaDisplayName(persona) })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error updating conversation persona:", error);
    }
  };

  // Send a message
  const handleSendMessage = async (content: string) => {
    // Create a conversation if one doesn't exist
    if (!currentConversationId) {
      try {
        // Generate a title from the first message
        const title =
          content.length > 30 ? `${content.substring(0, 30)}...` : content;

        // Create a new conversation in the database
        const newConversation = await createConversation(title, currentPersona);
        setCurrentConversationId(newConversation.id);

        // Add to chat history
        const newChatItem: ChatHistoryItem = {
          id: newConversation.id,
          title: newConversation.title,
          date: new Date().toISOString(),
          selected: true,
        };

        setChatHistory((prev) => [
          newChatItem,
          ...prev.map((chat) => ({ ...chat, selected: false })),
        ]);
      } catch (error) {
        console.error("Error creating conversation:", error);
      }
    }

    // Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      content,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Save user message to database if authenticated and conversation exists
    if (isAuthenticated && currentConversationId) {
      try {
        await saveMessage(currentConversationId, {
          id: userMessage.id,
          content: userMessage.content,
          sender: userMessage.sender,
          timestamp: userMessage.timestamp,
        });
      } catch (error) {
        console.error("Error saving user message:", error);
      }
    }

    // Add bot response placeholder
    const loadingMessage: Message = {
      id: `loading-${Date.now()}`,
      content: "Thinking...",
      sender: "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(currentPersona),
    };

    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // Prepare messages for the AI
      const aiMessages = [
        {
          role: "system" as const,
          content: `You are a helpful AI assistant with expertise in sustainability and environmental topics. 
                   Your name is ${getPersonaDisplayName(currentPersona)}. 
                   Provide helpful and accurate information about sustainability, eco-friendly practices, 
                   and environmental conservation.`,
        },
        ...messages
          .filter((msg) => msg.sender === "user" || msg.sender === "bot")
          .map((msg) => ({
            role:
              msg.sender === "user"
                ? ("user" as const)
                : ("assistant" as const),
            content: msg.content,
          })),
        {
          role: "user" as const,
          content,
        },
      ];

      // Get AI response
      const aiResponse = await import("../services/aiService").then((module) =>
        module.sendChatMessage(aiMessages),
      );

      // Remove loading message
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));

      // Add AI response
      const botResponse: Message = {
        id: `msg-${Date.now()}-bot`,
        content: aiResponse,
        sender: "bot" as const,
        timestamp: new Date(),
        persona: getPersonaDisplayName(currentPersona) as Message["persona"],
      };

      setMessages((prev) => [...prev, botResponse]);

      // Save bot response to database if authenticated and conversation exists
      if (isAuthenticated && currentConversationId) {
        try {
          await saveMessage(currentConversationId, {
            id: botResponse.id,
            content: botResponse.content,
            sender: botResponse.sender,
            timestamp: botResponse.timestamp,
            persona: botResponse.persona,
          });
        } catch (error) {
          console.error("Error saving bot response:", error);
        }
      }
    } catch (error) {
      console.error("Error getting AI response:", error);

      // Remove loading message
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id));

      // Show error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content:
          "I'm sorry, I couldn't process your request. Please check your API key in settings and try again later.",
        sender: "bot" as const,
        timestamp: new Date(),
        persona: getPersonaDisplayName(currentPersona) as Message["persona"],
      };

      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  // Create a new chat
  const handleNewChat = async () => {
    try {
      // Reset current conversation state
      setCurrentConversationId(null);

      // Reset messages to just the welcome message
      const welcomeMessage: Message = {
        id: `welcome-${Date.now()}`,
        content: getPersonaWelcomeMessage(currentPersona),
        sender: "bot",
        timestamp: new Date(),
        persona: getPersonaDisplayName(currentPersona),
      };

      setMessages([welcomeMessage]);

      // Update chat history selection state
      setChatHistory((prev) =>
        prev.map((chat) => ({ ...chat, selected: false })),
      );
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  };

  // Select a chat from history
  const handleSelectChat = async (id: string) => {
    try {
      // Set the current conversation ID
      setCurrentConversationId(id);

      // Update chat history selection state
      setChatHistory((prev) =>
        prev.map((chat) => ({
          ...chat,
          selected: chat.id === id,
        })),
      );

      // Load messages for this conversation
      if (isAuthenticated) {
        const conversation = await getConversationWithMessages(id);

        if (conversation && conversation.messages) {
          // Update messages state with loaded messages
          setMessages(conversation.messages);

          // Update current persona based on the conversation
          const personaType =
            (Object.entries(getPersonaDisplayName).find(
              ([_, displayName]) => displayName === conversation.persona,
            )?.[0] as PersonaType) || "greenbot";

          setCurrentPersona(personaType);
        }
      }
    } catch (error) {
      console.error("Error selecting chat:", error);
    }
  };

  // Change the current persona
  const handlePersonaChange = (persona: PersonaType) => {
    setCurrentPersona(persona);

    // Replace the last bot message with a persona welcome message
    const botMessage: Message = {
      id: `persona-change-${Date.now()}`,
      content: getPersonaWelcomeMessage(persona),
      sender: "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(persona),
    };

    setMessages((prev) => {
      const lastBotMessageIndex = [...prev]
        .reverse()
        .findIndex((msg) => msg.sender === "bot");

      if (lastBotMessageIndex >= 0) {
        // Replace the last bot message
        const newMessages = [...prev];
        newMessages[prev.length - 1 - lastBotMessageIndex] = botMessage;
        return newMessages;
      } else {
        // No bot message found, just add a new one
        return [...prev, botMessage];
      }
    });

    // Update conversation persona in database if needed
    if (currentConversationId) {
      updateConversationPersona(currentConversationId, persona);
    }
  };

  // Quiz related functions
  const handleStartQuiz = () => {
    setIsQuizOpen(true);
  };

  const handleQuizComplete = (score: number, total: number) => {
    setIsQuizOpen(false);

    // Add a message about the quiz results to the chat
    const botMessage: Message = {
      id: `quiz-result-${Date.now()}`,
      content: `You've completed the quiz with a score of ${score}/${total}! ${
        score >= total * 0.7
          ? "Great job! You have a solid understanding of this topic."
          : "Keep learning! There's always more to discover about sustainability."
      }`,
      sender: "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(currentPersona),
    };

    setMessages((prev) => [...prev, botMessage]);
  };

  // Return the state and functions
  return {
    currentPersona,
    messages,
    chatHistory,
    isAuthenticated,
    isLoading,
    isQuizOpen,
    currentConversationId,
    setIsQuizOpen,
    handleSendMessage,
    handleNewChat,
    handleSelectChat,
    handlePersonaChange,
    handleStartQuiz,
    handleQuizComplete,
    getPersonaDisplayName,
  };
}
