import { AlertTriangle, Key, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface ApiKeySetupPromptProps {
  provider?: string;
  onDismiss?: () => void;
}

const ApiKeySetupPrompt = ({ provider = "OpenAI", onDismiss }: ApiKeySetupPromptProps) => {
  return (
    <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5" />
          API Key Required
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          To start chatting, you need to add your {provider} API key. This allows GreenBot to connect to AI services securely.
        </p>

        <div className="rounded-md bg-white dark:bg-gray-800 p-3 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-medium mb-2 text-gray-900 dark:text-white">How to get started:</p>
          <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 list-decimal list-inside">
            <li>Get an API key from {provider === "OpenAI" ? "OpenAI.com" : provider === "DeepSeek" ? "DeepSeek.com" : "X.ai"}</li>
            <li>Go to the Admin Panel to add your key</li>
            <li>Start chatting with GreenBot!</li>
          </ol>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => window.location.href = '/admin'}
            className="flex-1 bg-[#8BA888] hover:bg-[#8BA888]/90 text-white"
          >
            <Key className="h-4 w-4 mr-2" />
            Go to Admin Panel
          </Button>
          {onDismiss && (
            <Button
              onClick={onDismiss}
              variant="outline"
              className="border-amber-300 dark:border-amber-700"
            >
              Dismiss
            </Button>
          )}
        </div>

        <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />
            Your API keys are stored securely in your database and never exposed to the client.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiKeySetupPrompt;
