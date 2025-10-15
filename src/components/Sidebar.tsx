import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { ScrollArea } from "./ui/scroll-area";
import { PlusCircle, Settings, MessageSquare, Trash2, Leaf, Shield, LogOut } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { cn } from "../lib/utils";
import PersonaSelector, { PersonaType } from "./PersonaSelector";
import { supabase } from "../lib/supabase";

// Define consistent localStorage keys
const LOCAL_STORAGE_KEYS = {
  DELETED_CHATS: "deletedChats",
  UNAUTHENTICATED_CHATS: "unauthenticatedChats",
};

interface ChatHistoryItem {
  id: string;
  title: string;
  date: string;
  selected?: boolean;
}

interface SidebarProps {
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  onOpenSettings?: () => void;
  chatHistory?: ChatHistoryItem[];
  className?: string;
  initialPersona?: PersonaType;
  onSelectPersona?: (persona: PersonaType) => void;
}

const Sidebar = ({
  onNewChat = () => {},
  onSelectChat = () => {},
  onOpenSettings = () => {},
  chatHistory = [], // Default to empty array instead of sample items
  className,
  initialPersona = "greenbot",
  onSelectPersona = () => {},
}: SidebarProps) => {
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [selectedPersona, setSelectedPersona] =
    useState<PersonaType>(initialPersona);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Function to get deleted chats from localStorage
  const getDeletedChats = (): string[] => {
    try {
      return JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_KEYS.DELETED_CHATS) || "[]",
      );
    } catch (error) {
      console.error("Error getting deleted chats:", error);
      return [];
    }
  };

  // Function to filter out deleted chats
  const filterDeletedChats = (chats: ChatHistoryItem[]): ChatHistoryItem[] => {
    const deletedChats = getDeletedChats();
    return chats.filter((chat) => !deletedChats.includes(chat.id));
  };

  // Fetch user email on component mount
  useEffect(() => {
    const fetchUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };

    fetchUserEmail();
  }, []);

  // Clean up deleted chats on component mount and when chatHistory changes
  useEffect(() => {
    if (chatHistory && chatHistory.length > 0) {
      const filteredHistory = filterDeletedChats(chatHistory);
      setHistory(filteredHistory);
    }
  }, [chatHistory]);

  const handleDeleteChat = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Update local state immediately for responsive UI
    setHistory(history.filter((chat) => chat.id !== id));

    // Also update parent component's state through props
    if (onSelectChat && history.find((chat) => chat.id === id)?.selected) {
      // If the deleted chat was selected, select another chat
      const remainingChats = history.filter((chat) => chat.id !== id);
      if (remainingChats.length > 0) {
        onSelectChat(remainingChats[0].id);
      } else {
        // If no chats remaining, create a new one
        onNewChat();
      }
    }

    try {
      // Check if user is authenticated
      const { data } = await supabase.auth.getSession();
      const isAuthenticated = !!data.session;

      if (isAuthenticated) {
        // Delete from Supabase database
        const { deleteConversation } = await import("../lib/chat-service");
        await deleteConversation(id);
        console.log(`Deleted conversation ${id} from database`);
      } else {
        // For unauthenticated users, only update localStorage
        const deletedChats = getDeletedChats();
        if (!deletedChats.includes(id)) {
          deletedChats.push(id);
          localStorage.setItem(
            LOCAL_STORAGE_KEYS.DELETED_CHATS,
            JSON.stringify(deletedChats),
          );
        }

        // Also update unauthenticated chats in localStorage
        const storedChats = localStorage.getItem(
          LOCAL_STORAGE_KEYS.UNAUTHENTICATED_CHATS,
        );
        if (storedChats) {
          try {
            const parsedChats = JSON.parse(storedChats);
            const filteredChats = parsedChats.filter(
              (chat: any) => chat.id !== id,
            );
            localStorage.setItem(
              LOCAL_STORAGE_KEYS.UNAUTHENTICATED_CHATS,
              JSON.stringify(filteredChats),
            );
          } catch (error) {
            console.error("Error updating unauthenticated chats:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
      // Optionally show error message to user
    }
  };

  const handlePersonaChange = (persona: PersonaType) => {
    setSelectedPersona(persona);
    onSelectPersona(persona);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full w-[280px] sm:w-[320px] bg-gray-50 dark:bg-[#2A3130] text-gray-800 dark:text-white p-3 sm:p-4 border-r border-gray-200 dark:border-gray-700",
        className,
      )}
    >
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 sm:h-6 sm:w-6 text-[#4B9460] dark:text-[#98C9A3]" />
          <h1 className="text-lg sm:text-xl font-semibold">GreenBot</h1>
        </div>
        <UserAvatar className="h-7 w-7 sm:h-8 sm:w-8" />
      </div>

      <Button
        onClick={onNewChat}
        className="bg-[#4B9460] hover:bg-[#3A7348] dark:bg-[#8BA888] dark:hover:bg-[#98C9A3] text-white dark:text-[#2F3635] mb-3 sm:mb-4 flex items-center gap-2 text-sm sm:text-base h-9 sm:h-10"
      >
        <PlusCircle className="h-4 w-4" />
        New Chat
      </Button>

      <PersonaSelector
        selectedPersona={selectedPersona}
        onSelectPersona={handlePersonaChange}
        className="mb-3 sm:mb-4"
      />

      <div className="text-xs sm:text-sm font-medium mb-2 text-gray-600 dark:text-gray-300">
        Chat History
      </div>

      <ScrollArea className="flex-1 -mx-4 px-4">
        <div className="space-y-2">
          {history.length > 0 ? (
            history.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  "flex items-center justify-between p-2 sm:p-3 rounded-md cursor-pointer group",
                  chat.selected
                    ? "bg-gray-200 dark:bg-[#2C4A3E]"
                    : "hover:bg-gray-100 dark:hover:bg-[#2C4A3E]/50",
                )}
              >
                <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0 text-[#4B9460] dark:text-[#98C9A3]" />
                    <div className="truncate text-sm sm:text-base">{chat.title}</div>
                  </div>
                  <div className="ml-5 sm:ml-6 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    {chat.date}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#2C4A3E] flex-shrink-0"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                >
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400">
              No chat history. Start a new conversation!
            </div>
          )}
        </div>
      </ScrollArea>

      <Separator className="my-3 sm:my-4 bg-gray-200 dark:bg-gray-700" />

      <Button
        variant="ghost"
        className="justify-start text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-[#2C4A3E] text-sm sm:text-base h-9 sm:h-10"
        onClick={onOpenSettings}
      >
        <Settings className="mr-2 h-4 w-4" />
        Settings
      </Button>

      <Button
        variant="ghost"
        className="justify-start text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-[#2C4A3E] text-sm sm:text-base h-9 sm:h-10"
        onClick={() => (window.location.pathname = "/admin")}
      >
        <Shield className="mr-2 h-4 w-4" />
        Admin Panel
      </Button>

      {/* User Email Display */}
      {userEmail && (
        <div className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md bg-gray-100 dark:bg-[#2C4A3E]/50 border border-gray-200 dark:border-gray-700">
          <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">
            Signed in as
          </div>
          <div className="text-xs sm:text-sm font-medium text-gray-800 dark:text-white truncate" title={userEmail}>
            {userEmail}
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        className="justify-start text-gray-600 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-[#2C4A3E] text-sm sm:text-base h-9 sm:h-10"
        onClick={async () => {
          await supabase.auth.signOut();
          window.location.reload();
        }}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>

      <div className="mt-3 sm:mt-4 text-[10px] sm:text-xs text-center text-gray-500 dark:text-gray-400">
        <p>Reducing carbon footprint</p>
        <p>one chat at a time</p>
      </div>
    </div>
  );
};

export default Sidebar;
