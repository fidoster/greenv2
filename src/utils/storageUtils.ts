import { ChatHistoryItem } from "../hooks/useChatState";

export const LOCAL_STORAGE_KEYS = {
  DELETED_CHATS: "deletedChats",
  UNAUTHENTICATED_CHATS: "unauthenticatedChats",
  HAS_SEEN_INTRO: "hasSeenIntro",
};

/**
 * Get the list of deleted chat IDs from localStorage
 */
export function getDeletedChats(): string[] {
  try {
    const deletedChats = localStorage.getItem(LOCAL_STORAGE_KEYS.DELETED_CHATS);
    if (!deletedChats) return [];
    const parsed = JSON.parse(deletedChats);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error getting deleted chats:", error);
    return [];
  }
}

/**
 * Filter out deleted chats from a chat history list
 */
export function filterDeletedChats(
  chats: ChatHistoryItem[],
): ChatHistoryItem[] {
  const deletedChats = getDeletedChats();
  return chats.filter((chat) => !deletedChats.includes(chat.id));
}

/**
 * Update unauthenticated chats in localStorage
 */
export function updateUnauthenticatedChats(
  updater: (prev: ChatHistoryItem[]) => ChatHistoryItem[],
): ChatHistoryItem[] {
  try {
    // Get current chats from localStorage
    const storedChats = localStorage.getItem(
      LOCAL_STORAGE_KEYS.UNAUTHENTICATED_CHATS,
    );
    const currentChats = storedChats ? JSON.parse(storedChats) : [];

    // Apply the updater function
    const updatedChats = updater(currentChats);

    // Filter out deleted chats
    const deletedChats = getDeletedChats();
    const filteredChats = updatedChats.filter(
      (chat) => !deletedChats.includes(chat.id),
    );

    // Save back to localStorage
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.UNAUTHENTICATED_CHATS,
      JSON.stringify(filteredChats),
    );

    return filteredChats;
  } catch (error) {
    console.error(
      "Error updating unauthenticated chats in localStorage:",
      error,
    );
    return [];
  }
}

/**
 * Generate a title from the first user message content
 */
export function generateTitleFromContent(content: string): string {
  // Take the first 30 characters or the first sentence, whichever is shorter
  const firstSentence = content.split(/[.!?]\s/)[0];
  let shortTitle =
    firstSentence.length > 30
      ? firstSentence.substring(0, 30) + "..."
      : firstSentence;

  // Ensure the title is not too short
  if (shortTitle.length < 10 && content.length > 10) {
    shortTitle =
      content.substring(0, Math.min(30, content.length)) +
      (content.length > 30 ? "..." : "");
  }

  return shortTitle;
}
