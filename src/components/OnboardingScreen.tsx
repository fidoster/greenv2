import React, { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Leaf, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingScreenProps {
  onConnect: (apiKey: string) => Promise<boolean>;
  isLoading?: boolean;
}

const OnboardingScreen = ({
  onConnect = async () => true,
  isLoading = false,
}: OnboardingScreenProps) => {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      setError("Please enter your API key");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const isValid = await onConnect(apiKey);
      if (!isValid) {
        setError("Invalid API key. Please try again.");
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F5] dark:bg-[#2F3635] p-6">
      <div className="relative w-full max-w-md">
        <div className="w-full p-8 space-y-6 bg-white dark:bg-[#3A4140] rounded-lg shadow-md">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-[#8BA888]">
              <Leaf className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#2C4A3E] dark:text-white">
              Welcome to GreenBot
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Your sustainable AI assistant for environmental topics
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-[#2F3635] dark:text-white"
              >
                Enter your API key
              </label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your API key"
                className={cn(
                  "border-[#8BA888] focus-visible:ring-[#98C9A3] dark:bg-[#2F3635] dark:border-[#4A5654]",
                  error && "border-red-500",
                )}
                disabled={isSubmitting || isLoading}
              />
              {error && (
                <div className="flex items-center mt-2 text-sm text-red-500">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleConnect}
              disabled={isSubmitting || isLoading}
              className="w-full bg-[#2C4A3E] hover:bg-[#1a2e26] text-white"
            >
              {isSubmitting || isLoading ? (
                <>
                  <svg
                    className="w-4 h-4 mr-2 animate-spin"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>

          <div className="pt-4 mt-6 text-xs text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
            <p>
              By connecting, you agree to our Terms of Service and Privacy
              Policy
            </p>
            <p className="mt-2">
              <span className="inline-flex items-center text-[#8BA888]">
                <Leaf className="w-3 h-3 mr-1" /> Powered by sustainable
                technology
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingScreen;
