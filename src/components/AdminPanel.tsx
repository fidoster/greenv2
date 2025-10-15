import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { PostgrestError } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { saveApiKeys } from "../lib/chat-service";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Key, Loader2, AlertTriangle } from "lucide-react";

interface ApiKey {
  id: string;
  user_id: string;
  openai_key?: string;
  deepseek_key?: string;
  grok_key?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  service?: string;
}

interface FormattedApiKey {
  id: string;
  service: string;
  key: string;
  description: string;
  created_at: string;
}

const AdminPanel = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<FormattedApiKey[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [error, setError] = useState<string | Error | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states for API keys
  const [newApiKey, setNewApiKey] = useState<{
    service: "openai" | "deepseek" | "grok";
    key: string;
    description: string;
  }>({
    service: "openai",
    key: "",
    description: "",
  });

  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (userData.user) {
          setCurrentUser(userData.user);
          await fetchApiKeys(userData.user.id);
        } else {
          setError("You must be logged in to manage API keys.");
          console.log("No user logged in.");
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
        setError(
          err instanceof Error
            ? err.message
            : "An unknown error occurred during setup.",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const fetchApiKeys = async (userId: string) => {
    console.log("Fetching API keys for user:", userId);
    try {
      setError(null);

      const { data, error } = await supabase
        .from("api_keys")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      console.log("API keys data:", data, "Error:", error);

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // Convert the flat structure to the expected format
      const formattedKeys: FormattedApiKey[] = [];
      if (data) {
        const apiKeyData = data as ApiKey;
        if (apiKeyData.openai_key) {
          formattedKeys.push({
            id: apiKeyData.id,
            service: "openai",
            key: "••••••••" + (apiKeyData.openai_key || "").slice(-4),
            description: "OpenAI API Key",
            created_at: apiKeyData.created_at,
          });
          // Save to localStorage for the chat interface to use
          localStorage.setItem('openai-api-key', apiKeyData.openai_key);
        }
        if (apiKeyData.deepseek_key) {
          formattedKeys.push({
            id: apiKeyData.id,
            service: "deepseek",
            key: "••••••••" + (apiKeyData.deepseek_key || "").slice(-4),
            description: "DeepSeek API Key",
            created_at: apiKeyData.created_at,
          });
          // Save to localStorage for the chat interface to use
          localStorage.setItem('deepseek-api-key', apiKeyData.deepseek_key);
        }
        if (apiKeyData.grok_key) {
          formattedKeys.push({
            id: apiKeyData.id,
            service: "grok",
            key: "••••••••" + (apiKeyData.grok_key || "").slice(-4),
            description: "Grok API Key",
            created_at: apiKeyData.created_at,
          });
          // Save to localStorage for the chat interface to use
          localStorage.setItem('grok-api-key', apiKeyData.grok_key);
        }
      }
      setApiKeys(formattedKeys);
    } catch (error) {
      console.error("Error fetching API keys:", error);
      setError("Failed to fetch API keys");
    }
  };

  const handleAddApiKey = async () => {
    if (!currentUser?.id) {
      setError("User not authenticated. Cannot add API key.");
      console.error("Attempted to add API key without authenticated user.");
      return;
    }

    if (!newApiKey.key || !newApiKey.service) {
      setError("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      console.log("Adding API key:", newApiKey);

      // Use the saveApiKeys function which handles the service field properly
      await saveApiKeys({
        [newApiKey.service]: newApiKey.key,
        service: newApiKey.service,
      });

      // Also save the API key to localStorage for the chat interface to use
      localStorage.setItem(`${newApiKey.service}-api-key`, newApiKey.key);
      
      // Reset form and refresh list
      setNewApiKey({ service: "openai", key: "", description: "" });
      await fetchApiKeys(currentUser.id);
    } catch (error) {
      console.error("Error adding API key:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(`Error adding API key: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteApiKey = async (id: string, service: string) => {
    if (!currentUser || !currentUser.id) {
      setError("User not authenticated. Cannot delete API key.");
      return;
    }

    try {
      setError(null);
      console.log(`Deleting ${service} API key for user ${currentUser.id}`);

      // First, get the existing record to update it properly
      const { data: existingKey, error: fetchError } = await supabase
        .from("api_keys")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!existingKey) {
        throw new Error("API key record not found");
      }

      // Create a proper update object with all required fields
      const updateData = {
        id: existingKey.id,
        user_id: currentUser.id,
        openai_key: service === "openai" ? null : existingKey.openai_key,
        deepseek_key: service === "deepseek" ? null : existingKey.deepseek_key,
        grok_key: service === "grok" ? null : existingKey.grok_key,
        description: (existingKey as any).description || "",
        updated_at: new Date().toISOString(),
      };

      // Perform the update
      const { error } = await supabase.from("api_keys").upsert(updateData);

      if (error) {
        throw error;
      }

      await fetchApiKeys(currentUser.id);
    } catch (error) {
      console.error("Error deleting API key:", error);
      setError(
        error instanceof Error
          ? `Error deleting API key: ${error.message}`
          : "Error deleting API key",
      );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-[#8BA888]" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="container mx-auto p-6 bg-[#f0f7f2] dark:bg-[#1f2a28] min-h-screen">
        <Card className="w-full max-w-md mx-auto mt-10">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Please log in to manage API keys.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-[#f0f7f2] dark:bg-[#1f2a28] min-h-screen">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#2C4A3E] dark:text-white flex items-center">
          <Key className="w-8 h-8 mr-3 text-[#4B9460]" />
          API Key Management
        </h1>
        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 mt-0.5" />
              <div>
                <p className="text-red-700 dark:text-red-300">
                  {error ? (typeof error === 'object' && error !== null && 'message' in error 
                    ? String((error as { message: string }).message)
                    : String(error)) : 'An unknown error occurred'}
                </p>
              </div>
            </div>
          </div>
        )}
      </header>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add/Update API Key</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="service">Service</Label>
              <Select
                value={newApiKey.service}
                onValueChange={(value) => {
                  if (
                    value === "openai" ||
                    value === "deepseek" ||
                    value === "grok"
                  ) {
                    setNewApiKey((prev) => ({ ...prev, service: value }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="grok">Grok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="key">API Key</Label>
              <Input
                id="key"
                type="password"
                value={newApiKey.key}
                onChange={(e) =>
                  setNewApiKey({ ...newApiKey, key: e.target.value })
                }
                placeholder="Enter API Key"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={newApiKey.description}
                onChange={(e) =>
                  setNewApiKey({ ...newApiKey, description: e.target.value })
                }
                placeholder="e.g., Primary key for project"
              />
            </div>
            <Button
              onClick={handleAddApiKey}
              disabled={isSaving || !newApiKey.key}
              className="w-full"
            >
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSaving ? "Saving..." : "Save API Key"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Display Existing API Keys */}
      <Card>
        <CardHeader>
          <CardTitle>Current API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {apiKeys.length > 0 ? (
            <ul className="space-y-3">
              {apiKeys.map((apiKey) => (
                <li
                  key={`${apiKey.id}-${apiKey.service}`}
                  className="p-3 border rounded-md bg-white dark:bg-gray-800 flex justify-between items-center"
                >
                  <div>
                    <span className="font-semibold">
                      {apiKey.service.toUpperCase()}
                    </span>
                    :
                    <span className="text-sm text-gray-600 dark:text-gray-400 ml-2 truncate">
                      {"••••••••" + apiKey.key.slice(-4)}
                    </span>
                    {apiKey.description && (
                      <p className="text-xs text-gray-500">
                        {apiKey.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() =>
                      handleDeleteApiKey(apiKey.id, apiKey.service)
                    }
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No API keys configured yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPanel;
