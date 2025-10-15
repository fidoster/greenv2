import React, { useRef, useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import ChatArea from "./ChatArea";
import SettingsPanel from "./SettingsPanel";
import QuizButton from "./QuizButton";
import QuizInterface from "./QuizInterface";
import { PersonaType } from "./PersonaSelector";
import { useTheme } from "./ThemeProvider";
import { supabase } from "../lib/supabase";
import { v4 as uuidv4 } from "uuid";

// If you don't have uuid installed, you can use this simple implementation
// const uuidv4 = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

interface DeepseekMessage {
  role: "user" | "system" | "assistant";
  content: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
  persona?: "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian";
}

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  selected?: boolean;
}

interface ChatInterfaceProps {
  initialPersona?: PersonaType;
}

const ChatInterface = ({ initialPersona = "greenbot" }: ChatInterfaceProps) => {
  const { theme } = useTheme();
  const [currentPersona, setCurrentPersona] =
    useState<PersonaType>(initialPersona);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      content:
        "Hello! I'm GreenBot, your sustainable AI assistant. How can I help you with environmental topics today?",
      sender: "bot" as "user" | "bot",
      timestamp: new Date(Date.now() - 60000),
      persona: "GreenBot" as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
    },
  ]);
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([
    {
      id: "default",
      title: "New Conversation",
      date: new Date().toLocaleDateString(),
      selected: true,
    },
  ]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("default");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations from local storage or database when component mounts
  useEffect(() => {
    const loadConversations = async () => {
      setIsLoading(true);
      try {
        // Check if user is authenticated with Supabase
        const { data } = await supabase.auth.getSession();
        const isAuthenticated = !!data.session;

        // If authenticated, ONLY load from Supabase (not localStorage)
        // This prevents users from seeing other users' localStorage data
        if (isAuthenticated) {
          try {
            // Import the chat service functions
            const { getConversations, getConversationWithMessages } =
              await import("../lib/chat-service");

            // Load conversations from Supabase
            const conversations = await getConversations();

            console.log(`Loaded ${conversations?.length || 0} conversations from Supabase`);

            if (conversations && conversations.length > 0) {
              const formattedHistory = conversations.map((conv) => ({
                id: conv.id,
                title: conv.title,
                date: new Date(conv.updated_at).toLocaleDateString(),
                selected: false,
              }));

              // Set the first conversation as selected
              formattedHistory[0].selected = true;
              setCurrentConversationId(formattedHistory[0].id);

              // Load messages for the selected conversation
              const conversation = await getConversationWithMessages(
                formattedHistory[0].id,
              );

              if (
                conversation &&
                conversation.messages &&
                conversation.messages.length > 0
              ) {
                console.log(`Loaded ${conversation.messages.length} messages`);
                setMessages(conversation.messages as ChatMessage[]);

                // Update current persona based on the last bot message
                const lastBotMessage = [...conversation.messages]
                  .reverse()
                  .find((msg) => msg.sender === "bot" && msg.persona);

                if (lastBotMessage && lastBotMessage.persona) {
                  const personaType = getPersonaTypeFromDisplayName(
                    lastBotMessage.persona,
                  );
                  if (personaType) {
                    setCurrentPersona(personaType);
                  }
                }
              } else {
                // Conversation exists but has no messages - show welcome message
                console.log('Conversation exists but no messages found');
                const welcomeMessage: ChatMessage = {
                  id: uuidv4(),
                  content: `Hello! I'm GreenBot, your sustainable AI assistant. How can I help you with environmental topics today?`,
                  sender: "bot",
                  timestamp: new Date(),
                  persona: "GreenBot",
                };
                setMessages([welcomeMessage]);
              }

              setChatHistory(formattedHistory);
            } else {
              // No conversations found - user is new or has no history
              console.log('No conversations found - showing default welcome');
              // Keep the default state (welcome message already set in useState)
            }
          } catch (error) {
            console.error("Error loading conversations from Supabase:", error);
          }
        } else {
          // Only load from localStorage if NOT authenticated
          const storedChats = localStorage.getItem("unauthenticatedChats");
          if (storedChats) {
            try {
              const parsedChats = JSON.parse(storedChats);
              if (parsedChats.length > 0) {
              // Format the stored chats
              const formattedHistory = parsedChats.map((chat: any) => ({
                id: chat.id,
                title: chat.title,
                date: new Date(chat.date).toLocaleDateString(),
                selected: false,
              }));

              // Set the first chat as selected
              if (formattedHistory.length > 0) {
                formattedHistory[0].selected = true;
                setCurrentConversationId(formattedHistory[0].id);

                // If this chat has messages, load them
                if (
                  parsedChats[0].messages &&
                  parsedChats[0].messages.length > 0
                ) {
                  // Need to ensure timestamp is converted back to Date objects
                  const processedMessages = parsedChats[0].messages.map(
                    (msg: any) => ({
                      ...msg,
                      timestamp: new Date(msg.timestamp),
                    }),
                  );

                  setMessages(processedMessages);

                  // Update current persona based on the last bot message
                  const lastBotMessage = [...processedMessages]
                    .reverse()
                    .find((msg: any) => msg.sender === "bot" && msg.persona);

                  if (lastBotMessage && lastBotMessage.persona) {
                    const personaType = getPersonaTypeFromDisplayName(
                      lastBotMessage.persona,
                    );
                    if (personaType) {
                      setCurrentPersona(personaType);
                    }
                  }
                }
              }

              setChatHistory(formattedHistory);
            }
          } catch (parseError) {
            console.error("Error parsing stored chats:", parseError);
          }
        }
        }
      } catch (error) {
        console.error("Error loading conversations:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConversations();
  }, []);

  const getPersonaTypeFromDisplayName = (
    displayName: string,
  ): PersonaType | null => {
    switch (displayName) {
      case "GreenBot":
        return "greenbot";
      case "EcoLife Guide":
        return "lifestyle";
      case "Waste Wizard":
        return "waste";
      case "Nature Navigator":
        return "nature";
      case "Power Sage":
        return "energy";
      case "Climate Guardian":
        return "climate";
      default:
        return null;
    }
  };

  const handleNewChat = async () => {
    // Create a new chat ID
    const newChatId = uuidv4();
    setCurrentConversationId(newChatId);

    // Create a new chat history item
    const newChat = {
      id: newChatId,
      title: "New Conversation",
      date: new Date().toLocaleDateString(),
      selected: true,
    };

    // Update history by deselecting all existing chats and adding the new one
    const updatedHistory = chatHistory.map((chat) => ({
      ...chat,
      selected: false,
    }));

    setChatHistory([newChat, ...updatedHistory]);

    // Reset messages with a default welcome message
    const welcomeMessage: ChatMessage = {
      id: uuidv4(),
      content: `Hello! I'm ${getPersonaDisplayName(currentPersona)}, your sustainable AI assistant. How can I help you with environmental topics today?`,
      sender: "bot" as "user" | "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
    };

    setMessages([welcomeMessage as ChatMessage]);

    // Check if user is authenticated
    const { data } = await supabase.auth.getSession();
    const isAuthenticated = !!data.session;

    if (isAuthenticated) {
      try {
        // Import the chat service functions
        const { createConversation, saveMessage } = await import(
          "../lib/chat-service"
        );

        // Create new conversation in Supabase
        const conversation = await createConversation(
          "New Conversation",
          currentPersona,
        );

        // Update the current conversation ID with the one from the database
        if (conversation && conversation.id) {
          setCurrentConversationId(conversation.id);

          // Update the chat history with the correct ID
          setChatHistory((prev) => [
            {
              ...newChat,
              id: conversation.id,
            },
            ...prev
              .filter((chat) => chat.id !== newChatId)
              .map((chat) => ({
                ...chat,
                selected: false,
              })),
          ]);

          // Add welcome message with the correct conversation ID
          await saveMessage(conversation.id, {
            id: welcomeMessage.id,
            content: welcomeMessage.content,
            sender: welcomeMessage.sender,
            timestamp: welcomeMessage.timestamp,
            persona: welcomeMessage.persona,
          });
        }
      } catch (error) {
        console.error("Error creating new conversation in Supabase:", error);
      }
    } else {
      // Save to local storage for unauthenticated users
      saveToLocalStorage(newChatId, "New Conversation", [welcomeMessage]);
    }
  };

  const handleSelectChat = async (id: string) => {
    if (isLoading || id === currentConversationId) return;

    setIsLoading(true);
    setCurrentConversationId(id);

    try {
      // Update chat history to reflect the selected chat
      const updatedHistory = chatHistory.map((chat) => ({
        ...chat,
        selected: chat.id === id,
      }));

      setChatHistory(updatedHistory);

      // Get the selected chat
      const selectedChat = updatedHistory.find((chat) => chat.id === id);

      if (!selectedChat) {
        throw new Error("Selected chat not found");
      }

      // Check if user is authenticated
      const { data } = await supabase.auth.getSession();
      const isAuthenticated = !!data.session;

      if (isAuthenticated) {
        try {
          // Import the chat service functions
          const { getConversationWithMessages, saveMessage } = await import(
            "../lib/chat-service"
          );

          // Load conversation with messages
          const conversation = await getConversationWithMessages(id);

          if (
            conversation &&
            conversation.messages &&
            conversation.messages.length > 0
          ) {
            setMessages(conversation.messages as ChatMessage[]);

            // Update current persona based on the last bot message
            const lastBotMessage = [...conversation.messages]
              .reverse()
              .find((msg) => msg.sender === "bot" && msg.persona);

            if (lastBotMessage && lastBotMessage.persona) {
              const personaType = getPersonaTypeFromDisplayName(
                lastBotMessage.persona,
              );
              if (personaType) {
                setCurrentPersona(personaType);
              }
            }
          } else {
            // If no messages found, create a welcome message
            const welcomeMessage: ChatMessage = {
              id: uuidv4(),
              content: `Hello! I'm ${getPersonaDisplayName(currentPersona)}, your sustainable AI assistant. How can I help you with environmental topics today?`,
              sender: "bot" as "user" | "bot",
              timestamp: new Date(),
              persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
            };

            setMessages([welcomeMessage as ChatMessage]);

            // Save the welcome message using the chat service
            await saveMessage(id, welcomeMessage);
          }
        } catch (error) {
          console.error("Error loading conversation from Supabase:", error);

          // Handle error by creating a fresh welcome message
          const welcomeMessage: ChatMessage = {
            id: uuidv4(),
            content: `Hello! I'm ${getPersonaDisplayName(currentPersona)}, your sustainable AI assistant. How can I help you with environmental topics today?`,
            sender: "bot" as "user" | "bot",
            timestamp: new Date(),
            persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
          };

          setMessages([welcomeMessage as ChatMessage]);
        }
      } else {
        // Load messages from localStorage for unauthenticated users
        const storedChats = localStorage.getItem("unauthenticatedChats");
        if (storedChats) {
          try {
            const parsedChats = JSON.parse(storedChats);
            const selectedStoredChat = parsedChats.find(
              (chat: any) => chat.id === id,
            );

            if (
              selectedStoredChat &&
              selectedStoredChat.messages &&
              selectedStoredChat.messages.length > 0
            ) {
              // Need to ensure timestamp is converted back to Date objects
              const processedMessages = selectedStoredChat.messages.map(
                (msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp),
                }),
              );

              setMessages(processedMessages);

              // Update current persona based on the last bot message
              const lastBotMessage = [...processedMessages]
                .reverse()
                .find((msg: any) => msg.sender === "bot" && msg.persona);

              if (lastBotMessage && lastBotMessage.persona) {
                const personaType = getPersonaTypeFromDisplayName(
                  lastBotMessage.persona,
                );
                if (personaType) {
                  setCurrentPersona(personaType);
                }
              }
            } else {
              // If no messages found, create a welcome message
              const welcomeMessage: ChatMessage = {
                id: uuidv4(),
                content: `Hello! I'm ${getPersonaDisplayName(currentPersona)}, your sustainable AI assistant. How can I help you with environmental topics today?`,
                sender: "bot" as "user" | "bot",
                timestamp: new Date(),
                persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
              };

              setMessages([welcomeMessage as ChatMessage]);

              // Save to localStorage
              saveToLocalStorage(id, selectedChat.title, [welcomeMessage]);
            }
          } catch (error) {
            console.error("Error processing stored chats:", error);

            // Handle error by creating a fresh welcome message
            const welcomeMessage: ChatMessage = {
              id: uuidv4(),
              content: `Hello! I'm ${getPersonaDisplayName(currentPersona)}, your sustainable AI assistant. How can I help you with environmental topics today?`,
              sender: "bot" as "user" | "bot",
              timestamp: new Date(),
              persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
            };

            setMessages([welcomeMessage as ChatMessage]);
            saveToLocalStorage(id, selectedChat.title, [welcomeMessage]);
          }
        }
      }
    } catch (error) {
      console.error("Error selecting chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveToLocalStorage = (
    chatId: string,
    title: string,
    chatMessages: ChatMessage[],
  ) => {
    try {
      const storedChats = localStorage.getItem("unauthenticatedChats");
      let parsedChats = storedChats ? JSON.parse(storedChats) : [];

      // Check if this chat already exists
      const existingChatIndex = parsedChats.findIndex(
        (chat: any) => chat.id === chatId,
      );

      if (existingChatIndex >= 0) {
        // Update existing chat
        parsedChats[existingChatIndex] = {
          ...parsedChats[existingChatIndex],
          title,
          messages: chatMessages,
          date: new Date().toISOString(),
        };
      } else {
        // Add new chat
        parsedChats.unshift({
          id: chatId,
          title,
          messages: chatMessages,
          date: new Date().toISOString(),
        });
      }

      // Store back to localStorage
      localStorage.setItem("unauthenticatedChats", JSON.stringify(parsedChats));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    // Get the current selected chat
    const selectedChat = chatHistory.find((chat) => chat.selected);
    if (!selectedChat) return;

    // Create the user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      content,
      sender: "user" as "user" | "bot",
      timestamp: new Date(),
    };

    // Add user message to the conversation
    setMessages((prevMessages) => [...prevMessages, userMessage]);

    // Show loading indicator
    const loadingMessageId = uuidv4();
    const loadingMessage: ChatMessage = {
      id: loadingMessageId,
      content: "Thinking...",
      sender: "bot" as "user" | "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
    };

    setMessages((prevMessages) => [...prevMessages, loadingMessage]);

    try {
      // Check if user is authenticated
      const { data } = await supabase.auth.getSession();
      const isAuthenticated = !!data.session;

      console.log(
        "Authentication status:",
        isAuthenticated ? "Authenticated" : "Not authenticated",
      );
      console.log("Current conversation ID:", currentConversationId);

      // If no conversation exists yet but user is authenticated, create one
      if (
        isAuthenticated &&
        (!currentConversationId || currentConversationId === "default")
      ) {
        try {
          console.log("Creating new conversation for authenticated user");
          const { createConversation } = await import("../lib/chat-service");
          const initialTitle =
            content.length > 30 ? content.substring(0, 30) + "..." : content;
          const conversation = await createConversation(
            initialTitle,
            currentPersona,
          );

          console.log("Created conversation:", conversation);

          if (conversation && conversation.id) {
            setCurrentConversationId(conversation.id);
            console.log("Set current conversation ID to:", conversation.id);

            // Update the selected chat with the new ID
            setChatHistory((prev) => {
              const updated = prev.map((chat) =>
                chat.selected
                  ? { ...chat, id: conversation.id, title: initialTitle }
                  : chat,
              );
              console.log("Updated chat history:", updated);
              return updated;
            });
          }
        } catch (error) {
          console.error("Error creating conversation:", error);
        }
      }

      let apiResponse;

      // Use the existing API integration
      if (true) {
        // Changed from isAuthenticated to always try the API if available
        try {
          // Import the API service
          const { callDeepseekAPI, getSystemPromptForPersona } = await import(
            "../lib/deepseek"
          );

          // Get selected API provider and corresponding API key
          const selectedApi =
            (localStorage.getItem("selected-api") as
              | "deepseek"
              | "openai"
              | "grok") || "openai";
          
          // Try to get API key from localStorage first
          const localStorageKey = localStorage.getItem(`${selectedApi}-api-key`);
          
          // If no key in localStorage, we'll let the callDeepseekAPI function
          // try to get it from the backend if useBackendKeys is enabled
          const apiKey = localStorageKey || '';

          // Create the message history
          const messageHistory = [
            {
              role: "system",
              content: getSystemPromptForPersona(
                getPersonaDisplayName(currentPersona),
              ),
            },
            // Add previous messages for context (limit to last few)
            ...messages
              .slice(-6) // Last 6 messages for context
              .filter((msg) => msg.id !== loadingMessageId) // Filter out loading message
              .map((msg) => ({
                role: msg.sender === "user" ? "user" : "assistant" as "user" | "system" | "assistant",
                content: msg.content,
              })),
            // Add the new user message
            { role: "user", content },
          ];

          // Call the API with the selected provider
          apiResponse = await callDeepseekAPI(
            messageHistory as DeepseekMessage[],
            apiKey,
            selectedApi,
          );
        } catch (apiError) {
          console.error("API error:", apiError);
          // Provide more specific error message based on the error
          let errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
          
          if (errorMessage.includes('API key not found') || errorMessage.includes('API key is required')) {
            apiResponse = `I'm ${getPersonaDisplayName(currentPersona)}. I couldn't access my AI service because no valid API key was found. Please check your API settings.`;
          } else if (errorMessage.includes('401')) {
            apiResponse = `I'm ${getPersonaDisplayName(currentPersona)}. The provided API key is invalid or has expired. Please check your API settings.`;
          } else {
            apiResponse = `I'm ${getPersonaDisplayName(currentPersona)}. I'm having trouble connecting to the AI service. Please try again later.`;
          }
          
          // Log the full error for debugging
          console.error('Detailed API error:', errorMessage);
        }
      } else {
        // For unauthenticated users without API key, use a simpler approach
        apiResponse = `I'm ${getPersonaDisplayName(currentPersona)}. Here's some information about "${content}" related to ${getPersonaSpecialty(currentPersona)}...`;
      }

      // Create the bot response with the API response
      const botMessage: ChatMessage = {
        id: uuidv4(),
        content: apiResponse,
        sender: "bot" as "user" | "bot",
        timestamp: new Date(),
        persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
      };

      // Replace loading message with the actual response
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === loadingMessageId ? botMessage : msg,
        ),
      );

      // If this is the first user message, update the chat title
      if (selectedChat.title === "New Conversation" && content.length > 0) {
        const newTitle =
          content.length > 30 ? content.substring(0, 30) + "..." : content;

        // Update the chat history with the new title
        const updatedHistory = chatHistory.map((chat) =>
          chat.id === selectedChat.id ? { ...chat, title: newTitle } : chat,
        );

        setChatHistory(updatedHistory);

        // Save the updated conversation
        const updatedMessages = messages
          .filter((msg) => msg.id !== loadingMessageId)
          .concat([userMessage, botMessage]);

        saveToLocalStorage(selectedChat.id, newTitle, updatedMessages);

        // If authenticated, update the conversation in Supabase
        if (isAuthenticated && currentConversationId) {
          try {
            console.log(
              "Saving messages to conversation:",
              currentConversationId,
            );
            const { saveMessage } = await import("../lib/chat-service");

            // Update conversation title
            const { data, error } = await supabase
              .from("conversations")
              .update({
                title: newTitle,
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentConversationId);

            if (error) {
              console.error("Error updating conversation title:", error);
            } else {
              console.log("Updated conversation title successfully");
            }

            // Save both messages
            console.log("Saving user message:", userMessage);
            await saveMessage(currentConversationId, userMessage);
            console.log("Saving bot message:", botMessage);
            await saveMessage(currentConversationId, botMessage);
          } catch (error) {
            console.error("Error updating conversation in Supabase:", error);
          }
        }
      } else {
        // Just save the updated messages
        const updatedMessages = messages
          .filter((msg) => msg.id !== loadingMessageId)
          .concat([userMessage, botMessage]);

        saveToLocalStorage(
          selectedChat.id,
          selectedChat.title,
          updatedMessages,
        );

        // If authenticated, save the messages to Supabase
        if (isAuthenticated && currentConversationId && currentConversationId !== "default") {
          try {
            console.log(
              "Saving messages to existing conversation:",
              currentConversationId,
            );
            const { saveMessage } = await import("../lib/chat-service");

            console.log("Saving user message:", userMessage);
            await saveMessage(currentConversationId, userMessage);

            console.log("Saving bot message:", botMessage);
            await saveMessage(currentConversationId, botMessage);

            // Update the conversation's updated_at timestamp
            const { data, error } = await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", currentConversationId);

            if (error) {
              console.error("Error updating conversation timestamp:", error);
            } else {
              console.log("Updated conversation timestamp successfully");
            }
          } catch (error) {
            console.error("Error saving messages to Supabase:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);

      // Replace loading message with error message
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        content: `I'm sorry, I encountered an error while processing your request. ${error instanceof Error ? error.message : "Please try again later."}`,
        sender: "bot" as "user" | "bot",
        timestamp: new Date(),
        persona: getPersonaDisplayName(currentPersona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
      };

      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === loadingMessageId ? errorMessage : msg,
        ),
      );
    }
  };

  // These functions are now imported from chat-service.ts when needed
  // to avoid code duplication and ensure consistent database operations

  const handlePersonaChange = async (persona: PersonaType) => {
    setCurrentPersona(persona);

    // Add a message from the new persona
    const botMessage: ChatMessage = {
      id: uuidv4(),
      content: `I'm now your ${getPersonaDisplayName(persona)}. How can I help you with ${getPersonaSpecialty(persona)}?`,
      sender: "bot" as "user" | "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(persona) as "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian",
    };

    setMessages((prevMessages) => [...prevMessages, botMessage]);

    // Get the current selected chat
    const selectedChat = chatHistory.find((chat) => chat.selected);
    if (selectedChat) {
      // Save the updated conversation with the new persona message
      const updatedMessages = [...messages, botMessage];
      saveToLocalStorage(selectedChat.id, selectedChat.title, updatedMessages);

      // Check if user is authenticated
      const { data } = await supabase.auth.getSession();
      const isAuthenticated = !!data.session;

      if (isAuthenticated && currentConversationId) {
        try {
          // Import the chat service functions
          const { saveMessage } = await import("../lib/chat-service");

          // Update conversation persona in Supabase
          await supabase
            .from("conversations")
            .update({
              persona: getPersonaDisplayName(persona),
              updated_at: new Date().toISOString(),
            })
            .eq("id", currentConversationId);

          // Save the persona change message
          await saveMessage(currentConversationId, botMessage);
        } catch (error) {
          console.error("Error updating persona in Supabase:", error);
        }
      }
    }
  };

  const getPersonaDisplayName = (
    persona: PersonaType,
  ): "GreenBot" | "EcoLife Guide" | "Waste Wizard" | "Nature Navigator" | "Power Sage" | "Climate Guardian" => {
    switch (persona) {
      case "greenbot":
        return "GreenBot";
      case "lifestyle":
        return "EcoLife Guide";
      case "waste":
        return "Waste Wizard";
      case "nature":
        return "Nature Navigator";
      case "energy":
        return "Power Sage";
      case "climate":
        return "Climate Guardian";
      default:
        return "GreenBot";
    }
  };

  const getPersonaSpecialty = (persona: PersonaType): string => {
    switch (persona) {
      case "greenbot":
        return "general sustainability topics";
      case "lifestyle":
        return "sustainable lifestyle choices";
      case "waste":
        return "waste reduction and recycling";
      case "nature":
        return "biodiversity and conservation";
      case "energy":
        return "energy efficiency and renewable energy";
      case "climate":
        return "climate action and resilience";
      default:
        return "environmental topics";
    }
  };

  const handleStartQuiz = () => {
    setIsQuizOpen(true);
  };

  const handleQuizComplete = async (score: number, total: number) => {
    setIsQuizOpen(false);

    // Add a message about the quiz results
    const botMessage: ChatMessage = {
      id: uuidv4(),
      content: `You've completed the quiz! You got ${score} out of ${total} questions correct. ${
        score / total >= 0.7
          ? "Great job! You have a good understanding of this topic."
          : "Keep learning! There's more to discover about sustainability."
      }`,
      sender: "bot",
      timestamp: new Date(),
      persona: getPersonaDisplayName(currentPersona),
    };

    setMessages((prevMessages) => [...prevMessages, botMessage]);

    // Save the updated conversation with the quiz result
    const selectedChat = chatHistory.find((chat) => chat.selected);
    if (selectedChat) {
      const updatedMessages = [...messages, botMessage];
      saveToLocalStorage(selectedChat.id, selectedChat.title, updatedMessages);

      // Check if user is authenticated
      const { data } = await supabase.auth.getSession();
      const isAuthenticated = !!data.session;

      if (isAuthenticated && currentConversationId) {
        try {
          // Import the chat service functions
          const { saveMessage } = await import("../lib/chat-service");

          // Save the quiz result message
          await saveMessage(currentConversationId, botMessage);

          // Update the conversation's updated_at timestamp
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", currentConversationId);
        } catch (error) {
          console.error("Error saving quiz result to Supabase:", error);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#2F3635]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#8BA888]"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#F5F5F5] dark:bg-[#2A3130]">
      {/* Sidebar */}
      <Sidebar
        chatHistory={chatHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
        initialPersona={currentPersona}
        onSelectPersona={handlePersonaChange}
      />

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Quiz Button at the top */}
        <div className="flex justify-between items-center p-2 bg-white dark:bg-[#2A3130] border-b border-[#E0E0E0] dark:border-[#3A4140]">
          <QuizButton
            onStartQuiz={handleStartQuiz}
            currentPersona={currentPersona}
            className="ml-auto"
          />
        </div>

        <div className="flex-1 overflow-hidden">
          <ChatArea
            messages={messages}
            onSendMessage={handleSendMessage}
            currentPersona={getPersonaDisplayName(currentPersona)}
            chatTitle={chatHistory.find((chat) => chat.selected)?.title}
            messagesEndRef={messagesEndRef}
          />
        </div>
      </div>

      {/* Settings Panel (conditionally rendered) */}
      {isSettingsOpen && (
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* Quiz Interface (conditionally rendered) */}
      {isQuizOpen && (
        <QuizInterface
          currentPersona={currentPersona}
          onClose={() => setIsQuizOpen(false)}
          onComplete={handleQuizComplete}
        />
      )}
    </div>
  );
};

export default ChatInterface;
