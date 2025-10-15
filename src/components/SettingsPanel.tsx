import React, { useState, useEffect } from "react";
import { Switch } from "./ui/switch";
import { Separator } from "./ui/separator";
import { Moon, Sun, Leaf, Info, Key } from "lucide-react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { supabase } from "../lib/supabase";
import { useTheme } from "./ThemeProvider";

interface SettingsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const SettingsPanel = ({
  isOpen = true,
  onClose = () => {},
}: SettingsPanelProps) => {
  const { theme, setTheme } = useTheme();
  const isDarkMode = theme === "dark";
  const [showMetrics, setShowMetrics] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoSave, setAutoSave] = useState(true);
  // Removed API key state variables as keys are now managed only in the backend
  const [selectedApi, setSelectedApi] = useState<
    "deepseek" | "openai" | "grok"
  >("deepseek");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [backendApiKeys, setBackendApiKeys] = useState<{
    deepseek: string;
    openai: string;
    grok: string;
  }>({ deepseek: "", openai: "", grok: "" });
  const [useBackendKeys, setUseBackendKeys] = useState<{
    deepseek: boolean;
    openai: boolean;
    grok: boolean;
  }>({ deepseek: true, openai: true, grok: true });

  useEffect(() => {
    // Load selected API provider from localStorage if available
    const savedSelectedApi =
      (localStorage.getItem("selected-api") as
        | "deepseek"
        | "openai"
        | "grok") || "openai";

    // Always use backend keys - set all to true by default
    setSelectedApi(savedSelectedApi);
    setUseBackendKeys({
      deepseek: true,
      openai: true,
      grok: true,
    });

    // Store the preference in localStorage
    localStorage.setItem("use-backend-deepseek", "true");
    localStorage.setItem("use-backend-openai", "true");
    localStorage.setItem("use-backend-grok", "true");

    // Get current user email and backend API keys
    const getUserData = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        setUserEmail(data.user.email || "");

        try {
          // Import dynamically to avoid circular dependencies
          const { getApiKeys } = await import("../lib/chat-service");
          const apiKeys = await getApiKeys();

          if (apiKeys) {
            setBackendApiKeys({
              deepseek: apiKeys.deepseek || "",
              openai: apiKeys.openai || "",
              grok: apiKeys.grok || "",
            });
          }
        } catch (error) {
          console.error("Error fetching API keys:", error);
        }
      }
    };

    getUserData();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-[#F5F5F5] p-6 shadow-lg dark:bg-[#2A3130] dark:text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[#2C4A3E] dark:text-white">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[#2C4A3E] hover:bg-[#98C9A3]/20 dark:text-white dark:hover:bg-white/20"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <Separator className="mb-4 bg-[#8BA888]/30" />

        <div className="space-y-4">
          {/* Theme Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isDarkMode ? (
                <Moon className="h-5 w-5 text-[#8BA888]" />
              ) : (
                <Sun className="h-5 w-5 text-[#8BA888]" />
              )}
              <span className="text-sm font-medium text-[#2C4A3E] dark:text-white">
                {isDarkMode ? "Dark Mode" : "Light Mode"}
              </span>
            </div>
            <Switch
              checked={isDarkMode}
              onCheckedChange={(checked) =>
                setTheme(checked ? "dark" : "light")
              }
              className="data-[state=checked]:bg-[#8BA888] data-[state=unchecked]:bg-gray-300"
            />
          </div>

          {/* Environmental Impact Metrics */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Leaf className="h-5 w-5 text-[#8BA888]" />
              <span className="text-sm font-medium text-[#2C4A3E] dark:text-white">
                Show Environmental Impact
              </span>
            </div>
            <Switch
              checked={showMetrics}
              onCheckedChange={setShowMetrics}
              className="data-[state=checked]:bg-[#8BA888] data-[state=unchecked]:bg-gray-300"
            />
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
                className="text-[#8BA888]"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <span className="text-sm font-medium text-[#2C4A3E] dark:text-white">
                Notifications
              </span>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={setNotificationsEnabled}
              className="data-[state=checked]:bg-[#8BA888] data-[state=unchecked]:bg-gray-300"
            />
          </div>

          {/* Auto-save */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
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
                className="text-[#8BA888]"
              >
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span className="text-sm font-medium text-[#2C4A3E] dark:text-white">
                Auto-save Conversations
              </span>
            </div>
            <Switch
              checked={autoSave}
              onCheckedChange={setAutoSave}
              className="data-[state=checked]:bg-[#8BA888] data-[state=unchecked]:bg-gray-300"
            />
          </div>
        </div>

        <Separator className="my-4 bg-[#8BA888]/30" />

        {/* Environmental Impact Stats */}
        {showMetrics && (
          <div className="rounded-md bg-[#98C9A3]/20 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Info className="h-4 w-4 text-[#2C4A3E]" />
              <h3 className="text-sm font-medium text-[#2C4A3E] dark:text-white">
                Your Environmental Impact
              </h3>
            </div>
            <div className="space-y-1 text-xs text-[#2C4A3E]/80 dark:text-white/80">
              <p>• Carbon saved: 0.8kg (vs. traditional search)</p>
              <p>• Energy efficiency: 92% better than average</p>
              <p>• Trees equivalent: 0.04 trees preserved</p>
            </div>
          </div>
        )}

        {/* API Key Section */}
        <div className="mt-4 rounded-md bg-[#F5F5F5] p-4 dark:bg-[#343C3B]">
          <div className="mb-3 flex items-center gap-2">
            <Key className="h-4 w-4 text-[#8BA888]" />
            <h3 className="text-sm font-medium text-[#2C4A3E] dark:text-white">
              AI API Settings
            </h3>
          </div>

          <div className="mb-2 text-xs text-[#2C4A3E]/80 dark:text-white/80">
            <p>Current user: {userEmail || "Not signed in"}</p>
          </div>

          <div className="space-y-3">
            <div className="mb-4">
              <label className="text-sm font-medium text-[#2C4A3E] dark:text-white mb-1 block">
                Select AI Provider
              </label>
              <Select
                value={selectedApi}
                onValueChange={(value: "deepseek" | "openai" | "grok") =>
                  setSelectedApi(value)
                }
              >
                <SelectTrigger className="bg-white dark:bg-[#343C3B] border-[#E0E0E0] dark:border-[#4A5250]">
                  <SelectValue placeholder="Select API Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="grok">Grok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedApi === "deepseek" && (
              <div className="space-y-2">
                <div className="text-xs text-green-600 dark:text-green-400">
                  Using backend API key for DeepSeek
                </div>
              </div>
            )}

            {selectedApi === "openai" && (
              <div className="space-y-2">
                <div className="text-xs text-green-600 dark:text-green-400">
                  Using backend API key for OpenAI
                </div>
              </div>
            )}

            {selectedApi === "grok" && (
              <div className="space-y-2">
                <div className="text-xs text-green-600 dark:text-green-400">
                  Using backend API key for Grok
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  setIsSaving(true);
                  try {
                    // Save selected API provider to localStorage
                    localStorage.setItem("selected-api", selectedApi);

                    // Get current API keys from input fields
                    const apiKeys = {
                      deepseek: "",
                      openai: "",
                      grok: "",
                    };

                    // Save API keys to database
                    const { data } = await supabase.auth.getUser();
                    if (data?.user) {
                      try {
                        const { saveApiKeys } = await import(
                          "../lib/chat-service"
                        );
                        await saveApiKeys(apiKeys);

                        // Update the backend API keys state
                        setBackendApiKeys(apiKeys);
                      } catch (error) {
                        console.error(
                          "Error saving API keys to database:",
                          error,
                        );
                      }
                    }

                    setSaveMessage("API settings saved successfully");
                  } catch (error) {
                    console.error("Error saving API settings:", error);
                    setSaveMessage("Error saving API settings");
                  } finally {
                    setIsSaving(false);
                    setTimeout(() => setSaveMessage(""), 3000);
                  }
                }}
                className="flex-1 bg-[#8BA888] hover:bg-[#8BA888]/90 text-white"
                disabled={isSaving || isTestingApi}
              >
                {isSaving ? "Saving..." : "Save API Settings"}
              </Button>

              <Button
                onClick={async () => {
                  // Get the backend API key for the selected service
                  let currentApiKey = backendApiKeys[selectedApi] || "";

                  if (!currentApiKey.trim()) {
                    setApiTestResult({
                      success: false,
                      message: `No ${selectedApi.toUpperCase()} API key configured. Please add your API key at /admin`,
                    });
                    return;
                  }

                  setIsTestingApi(true);
                  setApiTestResult(null);

                  try {
                    // Import dynamically to avoid circular dependencies
                    const { callDeepseekAPI } = await import("../lib/deepseek");
                    await callDeepseekAPI(
                      [
                        {
                          role: "system",
                          content: "You are a helpful assistant.",
                        },
                        { role: "user", content: "Test connection" },
                      ],
                      currentApiKey,
                      selectedApi,
                    );

                    setApiTestResult({
                      success: true,
                      message: `${selectedApi.toUpperCase()} API connection successful!`,
                    });
                  } catch (error) {
                    let errorMessage = "Unknown error";

                    if (error instanceof Error) {
                      errorMessage = error.message;

                      // Check for specific error patterns and provide helpful messages
                      if (errorMessage.includes("No API keys configured") || errorMessage.includes("needsSetup")) {
                        errorMessage = `No API keys configured. Please add your ${selectedApi.toUpperCase()} API key at /admin`;
                      } else if (errorMessage.includes("CORS") || errorMessage.includes("Failed to fetch")) {
                        errorMessage = "Connection error. Please ensure the Edge Function is deployed.";
                      } else if (errorMessage.includes("401") || errorMessage.includes("403")) {
                        errorMessage = "Invalid API key. Please check your key at /admin";
                      }
                    }

                    setApiTestResult({
                      success: false,
                      message: errorMessage,
                    });
                  } finally {
                    setIsTestingApi(false);
                  }
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={isSaving || isTestingApi}
              >
                {isTestingApi ? "Testing..." : "Test API"}
              </Button>
            </div>
            {saveMessage && (
              <p className="text-xs text-green-600 text-center">
                {saveMessage}
              </p>
            )}
            {apiTestResult && (
              <p
                className={`text-xs ${apiTestResult.success ? "text-green-600" : "text-red-600"} text-center mt-2`}
              >
                {apiTestResult.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
