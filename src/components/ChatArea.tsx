import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Droplet, Home, Leaf, Recycle, Send } from "lucide-react";
import MessageActions from "./MessageActions";
import { ScrollArea } from "./ui/scroll-area";
import { Badge } from "./ui/badge";
import { ThemeToggle } from "./ThemeToggle";

interface Message {
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

interface ChatAreaProps {
  messages?: Message[];
  onSendMessage?: (message: string) => void;
  currentPersona?:
    | "GreenBot"
    | "EcoLife Guide"
    | "Waste Wizard"
    | "Nature Navigator"
    | "Power Sage"
    | "Climate Guardian";
  chatTitle?: string;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

// Function to get a random sustainability fact
const getSustainabilityFact = () => {
  const facts = [
    "One mature tree absorbs approximately 48 pounds of CO₂ per year.",
    "Around 80% of marine pollution comes from land-based activities.",
    "Nearly 1/3 of all food produced worldwide is wasted, contributing to 8% of greenhouse gas emissions.",
    "Bamboo can grow up to 35 inches in a single day, making it one of the most renewable resources.",
    "LED lights use up to 90% less energy than incandescent bulbs and can last 25 times longer.",
    "More than 1 billion people in the world don't have access to clean water.",
    "Solar energy is the most abundant energy resource on Earth—173,000 terawatts strike Earth continuously.",
    "The Great Pacific Garbage Patch is a collection of marine debris that's twice the size of Texas.",
    "Recycling one aluminum can saves enough energy to run a TV for three hours.",
    "The average American uses about 100 gallons of water per day.",
    "Electric vehicles emit 54% fewer carbon emissions on average than gasoline-powered cars.",
    "Indoor plants can remove up to 87% of air toxins within 24 hours.",
    "Over 1 million seabirds and 100,000 marine mammals are killed by ocean pollution every year.",
    "Organic farming uses up to 50% less energy than conventional farming methods.",
    "The fashion industry is responsible for 10% of global carbon emissions, more than international flights and maritime shipping combined.",
  ];

  return facts[Math.floor(Math.random() * facts.length)];
};

// Simple markdown to HTML converter for basic formatting
const simpleMarkdownToHtml = (text: string) => {
  // Replace headers
  let html = text.replace(
    /^# (.*$)/gm,
    '<h1 class="text-xl font-bold mb-2">$1</h1>',
  );
  html = html.replace(
    /^## (.*$)/gm,
    '<h2 class="text-lg font-bold mb-2">$1</h2>',
  );
  html = html.replace(
    /^### (.*$)/gm,
    '<h3 class="text-md font-bold mb-2">$1</h3>',
  );

  // Replace bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Replace italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Replace lists
  html = html.replace(/^\s*-\s+(.*$)/gm, '<li class="ml-4">$1</li>');

  // Replace line breaks with proper spacing
  html = html.replace(/\n\n/g, "<br/><br/>");

  return html;
};

const ChatArea = ({
  messages = [
    {
      id: "1",
      content:
        "Hello! I'm GreenBot, your sustainable AI assistant. How can I help you with environmental topics today?",
      sender: "bot",
      timestamp: new Date(Date.now() - 60000),
      persona: "GreenBot",
    },
    {
      id: "2",
      content: "I'd like to learn about renewable energy options for my home.",
      sender: "user",
      timestamp: new Date(Date.now() - 30000),
    },
    {
      id: "3",
      content:
        "Great choice! Renewable energy for homes typically includes solar panels, small wind turbines, geothermal heat pumps, and biomass systems. Solar is the most common option, with decreasing installation costs and potential tax incentives. Would you like me to explain more about any specific renewable energy source?",
      sender: "bot",
      timestamp: new Date(),
      persona: "GreenBot",
    },
  ],
  onSendMessage = (message) => console.log("Message sent:", message),
  currentPersona = "GreenBot",
  chatTitle = "New Conversation",
  messagesEndRef,
}: ChatAreaProps) => {
  const [inputValue, setInputValue] = useState("");
  const [sustainabilityFact, setSustainabilityFact] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Use provided ref or fallback to local ref
  const endOfMessagesRef = messagesEndRef || messageEndRef;

  // Set the sustainability fact only once when component mounts
  useEffect(() => {
    setSustainabilityFact(getSustainabilityFact());
  }, []);

  // Improved scroll to bottom function
  const scrollToBottom = () => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    }

    // Use the built-in scroll area methods if available
    const scrollableNode = document.querySelector(
      "[data-radix-scroll-area-viewport]",
    );
    if (scrollableNode) {
      scrollableNode.scrollTop = scrollableNode.scrollHeight;
    }
  };

  // Auto-scroll to bottom when messages change
  useLayoutEffect(() => {
    // Immediate scroll attempt
    scrollToBottom();

    // Multiple scroll attempts with increasing delays
    const timeoutIds = [
      setTimeout(scrollToBottom, 50),
      setTimeout(scrollToBottom, 200),
      setTimeout(scrollToBottom, 500),
    ];

    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue("");

      // Schedule multiple scroll attempts after sending
      setTimeout(scrollToBottom, 100);
      setTimeout(scrollToBottom, 300);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F5F5F5] dark:bg-[#2A3130]">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between p-3 border-b border-[#E0E0E0] dark:border-[#3A4140] bg-white dark:bg-[#2A3130]">
        <div className="flex items-center space-x-2">
          {currentPersona === "GreenBot" && (
            <Leaf className="h-5 w-5 text-[#98C9A3]" />
          )}
          {currentPersona === "EcoLife Guide" && (
            <Home className="h-5 w-5 text-[#8BA888]" />
          )}
          {currentPersona === "Waste Wizard" && (
            <Recycle className="h-5 w-5 text-[#2C4A3E]" />
          )}
          {currentPersona === "Nature Navigator" && (
            <Droplet className="h-5 w-5 text-[#6AADCB]" />
          )}
          {currentPersona === "Power Sage" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-[#F6C344]"
            >
              <path d="M18 3v4"></path>
              <path d="M14 7h8"></path>
              <path d="M18 11v4"></path>
              <path d="M14 15h8"></path>
              <path d="M18 19v2"></path>
              <path d="M12 3v2"></path>
              <path d="M8 5h8"></path>
              <path d="M12 7v12"></path>
              <path d="M8 19h8"></path>
            </svg>
          )}
          {currentPersona === "Climate Guardian" && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-[#5D93E1]"
            >
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
            </svg>
          )}
          <h2 className="font-medium text-[#2F3635] dark:text-[#F5F5F5]">
            {chatTitle || currentPersona}
          </h2>
        </div>
        <div className="flex items-center">
          <ThemeToggle />
        </div>

      </div>

      {/* Chat messages area - using ScrollArea component */}
      <ScrollArea
        className="flex-1 p-4"
        id="chat-messages-container"
        type="always"
      >
        <div className="flex flex-col space-y-4">
          <div className="flex-grow min-h-[50vh]"></div>
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  message.sender === "user"
                    ? "bg-white dark:bg-[#3A4140] text-[#2F3635] dark:text-[#F5F5F5] border border-[#E0E0E0] dark:border-[#3A4140]"
                    : "bg-[#8BA888] dark:bg-[#2C4A3E] text-[#2F3635] dark:text-[#F5F5F5]"
                }`}
              >
                {message.sender === "bot" && message.persona && (
                  <div className="flex items-center mb-2">
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-white/20 text-[#2F3635] dark:text-[#F5F5F5] border-[#2F3635]/10 dark:border-[#F5F5F5]/10"
                    >
                      {message.persona === "GreenBot" && (
                        <Leaf className="h-3 w-3" />
                      )}
                      {message.persona === "EcoLife Guide" && (
                        <Home className="h-3 w-3" />
                      )}
                      {message.persona === "Waste Wizard" && (
                        <Recycle className="h-3 w-3" />
                      )}
                      {message.persona === "Nature Navigator" && (
                        <Droplet className="h-3 w-3" />
                      )}
                      {message.persona === "Power Sage" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                        >
                          <path d="M18 3v4"></path>
                          <path d="M14 7h8"></path>
                          <path d="M18 11v4"></path>
                          <path d="M14 15h8"></path>
                          <path d="M18 19v2"></path>
                          <path d="M12 3v2"></path>
                          <path d="M8 5h8"></path>
                          <path d="M12 7v12"></path>
                          <path d="M8 19h8"></path>
                        </svg>
                      )}
                      {message.persona === "Climate Guardian" && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-3 w-3"
                        >
                          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
                        </svg>
                      )}
                      <span>{message.persona}</span>
                    </Badge>
                  </div>
                )}
                {/* Replace the plain text with simple HTML rendering */}
                {message.sender === "user" ? (
                  <p className="whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                ) : (
                  <div
                    className="whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{
                      __html: simpleMarkdownToHtml(message.content),
                    }}
                  />
                )}
                <div className="flex justify-between items-center mt-2">
                  {message.sender === "bot" && (
                    <div className="flex items-center">
                      <MessageActions
                        onLike={() => {
                          console.log("Liked message:", message.id);
                          // Add any additional like functionality here
                        }}
                        onDislike={() => {
                          console.log("Disliked message:", message.id);
                          // Add any additional dislike functionality here
                        }}
                        onCopy={() => {
                          navigator.clipboard.writeText(message.content);
                          console.log("Copied message:", message.id);
                        }}
                        onRegenerate={() => {
                          console.log("Regenerate message:", message.id);
                          // Add regeneration functionality here
                        }}
                        className="opacity-100"
                      />
                    </div>
                  )}
                  <p
                    className={`text-xs opacity-70 ${message.sender === "bot" ? "ml-auto" : ""}`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {/* Invisible element to scroll to */}
          <div ref={endOfMessagesRef} />
        </div>
      </ScrollArea>

      {/* Message input area */}
      <div className="border-t border-[#E0E0E0] dark:border-[#3A4140] p-4 bg-white dark:bg-[#2A3130]">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Recycle your thoughts here..."
              className="pr-10 bg-[#F5F5F5] dark:bg-[#343C3B] border-[#E0E0E0] dark:border-[#4A5250] rounded-xl"
            />
            {currentPersona === "GreenBot" && (
              <Leaf className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#98C9A3] opacity-70" />
            )}
            {currentPersona === "EcoLife Guide" && (
              <Home className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#8BA888] opacity-70" />
            )}
            {currentPersona === "Waste Wizard" && (
              <Recycle className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#2C4A3E] opacity-70" />
            )}
            {currentPersona === "Nature Navigator" && (
              <Droplet className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6AADCB] opacity-70" />
            )}
            {currentPersona === "Power Sage" && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#F6C344] opacity-70"
              >
                <path d="M18 3v4"></path>
                <path d="M14 7h8"></path>
                <path d="M18 11v4"></path>
                <path d="M14 15h8"></path>
                <path d="M18 19v2"></path>
                <path d="M12 3v2"></path>
                <path d="M8 5h8"></path>
                <path d="M12 7v12"></path>
                <path d="M8 19h8"></path>
              </svg>
            )}
            {currentPersona === "Climate Guardian" && (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#5D93E1] opacity-70"
              >
                <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"></path>
              </svg>
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            className="bg-[#8BA888] hover:bg-[#2C4A3E] text-white rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
            disabled={!inputValue.trim()}
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
        <div className="flex items-center justify-center mt-2 text-xs text-[#8BA888] dark:text-[#98C9A3]">
          <span>💚 {sustainabilityFact}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
