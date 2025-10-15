import { useState } from "react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "../lib/supabase";
import { Leaf } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface AuthFormProps {
  onAuthSuccess?: () => void;
}

const AuthForm = ({ onAuthSuccess }: AuthFormProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // Listen for authentication state changes
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" && onAuthSuccess) {
      onAuthSuccess();
    }
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 relative overflow-hidden">
      {/* Modern background design with direct CSS styles */}
      <div className="fixed inset-0 z-0">
        {/* Base styling */}
        <div
          className="absolute inset-0 bg-[#f0f7f2] dark:bg-[#1f2a28]"
          style={{
            backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(152, 201, 163, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(44, 74, 62, 0.1) 0%, transparent 50%)
          `,
          }}
        ></div>

        {/* Diagonal stripes */}
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage: `
            linear-gradient(135deg, transparent 0%, transparent 49%, rgba(152, 201, 163, 0.2) 50%, transparent 51%, transparent 100%)
          `,
            backgroundSize: "40px 40px",
          }}
        ></div>

        {/* Circular pattern */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20 dark:opacity-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#8BA888]/30"></div>
          <div className="absolute inset-[40px] rounded-full border-2 border-[#8BA888]/25"></div>
          <div className="absolute inset-[80px] rounded-full border-2 border-[#8BA888]/20"></div>
          <div className="absolute inset-[120px] rounded-full border-2 border-[#8BA888]/15"></div>
          <div className="absolute inset-[160px] rounded-full border-2 border-[#8BA888]/10"></div>
          <div className="absolute inset-[200px] rounded-full border-2 border-[#8BA888]/5"></div>
        </div>

        {/* Top-left decoration */}
        <div className="absolute top-0 left-0 w-[350px] h-[350px]">
          <div className="absolute w-full h-full bg-[#4B9460]/10 dark:bg-[#4B9460]/5 rounded-br-[100%]"></div>
          <div className="absolute w-[250px] h-[250px] bg-[#98C9A3]/15 dark:bg-[#98C9A3]/8 rounded-br-[100%]"></div>
          <div className="absolute w-[150px] h-[150px] bg-[#8BA888]/20 dark:bg-[#8BA888]/10 rounded-br-[100%]"></div>
        </div>

        {/* Bottom-right decoration */}
        <div className="absolute bottom-0 right-0 w-[350px] h-[350px]">
          <div className="absolute w-full h-full bg-[#4B9460]/10 dark:bg-[#4B9460]/5 rounded-tl-[100%]"></div>
          <div className="absolute w-[250px] h-[250px] bg-[#98C9A3]/15 dark:bg-[#98C9A3]/8 rounded-tl-[100%]"></div>
          <div className="absolute w-[150px] h-[150px] bg-[#8BA888]/20 dark:bg-[#8BA888]/10 rounded-tl-[100%]"></div>
        </div>

        {/* Diagonal lines */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-[#8BA888]/0 via-[#8BA888]/20 to-[#8BA888]/0 rotate-45 origin-top transform -translate-x-1/2"></div>
          <div className="absolute top-0 left-2/4 w-px h-full bg-gradient-to-b from-[#8BA888]/0 via-[#8BA888]/15 to-[#8BA888]/0 rotate-45 origin-top transform -translate-x-1/2"></div>
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-[#8BA888]/0 via-[#8BA888]/10 to-[#8BA888]/0 rotate-45 origin-top transform -translate-x-1/2"></div>
        </div>

        {/* Dot pattern */}
        <div
          className="absolute inset-0 opacity-30 dark:opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at center, #2C4A3E 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        ></div>
      </div>

      {/* Login Form Card */}
      <div className="w-full max-w-md p-8 space-y-6 bg-white/90 dark:bg-[#3A4140]/90 rounded-lg shadow-xl backdrop-blur relative z-10 border border-white/20 dark:border-[#4A5654]/30">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center w-20 h-20 mb-4 rounded-full bg-gradient-to-br from-[#8BA888] to-[#4B9460] shadow-lg">
            <Leaf className="w-10 h-10 text-white drop-shadow-md" />
          </div>
          <h1 className="text-2xl font-bold text-[#2C4A3E] dark:text-white">
            Welcome to GreenBot
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Your sustainable AI assistant for environmental topics
          </p>
        </div>

        <div className="space-y-4">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: "#2C4A3E",
                    brandAccent: "#8BA888",
                    inputText: "var(--foreground)",
                    inputBackground: "transparent",
                    inputBorder: "lightgray",
                    inputLabelText: "gray",
                    inputPlaceholder: "darkgray",
                  },
                },
                dark: {
                  colors: {
                    brand: "#8BA888",
                    brandAccent: "#98C9A3",
                    brandButtonText: "white",
                    defaultButtonBackground: "#2F3635",
                    defaultButtonBackgroundHover: "#3A4140",
                    defaultButtonBorder: "#4A5654",
                    defaultButtonText: "#F9FAFB",
                    dividerBackground: "#4A5654",
                    inputBackground: "#2F3635",
                    inputBorder: "#4A5654",
                    inputBorderHover: "#8BA888",
                    inputBorderFocus: "#8BA888",
                    inputText: "#F9FAFB",
                    inputLabelText: "#D1D5DB",
                    inputPlaceholder: "#94A3B8",
                    messageText: "#F87171",
                    messageTextDanger: "#F87171",
                    messageBorder: "#DC2626",
                    messageBorderDanger: "#DC2626",
                    messageBackgroundDanger: "#7F1D1D",
                    anchorTextColor: "#98C9A3",
                    anchorTextHoverColor: "#8BA888",
                  },
                },
              },
              className: {
                button: "bg-[#2C4A3E] hover:bg-[#8BA888] text-white dark:bg-[#8BA888] dark:hover:bg-[#98C9A3]",
                anchor:
                  "text-[#2C4A3E] hover:text-[#8BA888] dark:text-[#98C9A3] dark:hover:text-[#8BA888] font-medium",
                container: "dark:text-white",
                divider: "dark:before:bg-gray-600 dark:after:bg-gray-600",
                input:
                  "bg-transparent dark:text-white dark:border-[#4A5654] dark:focus:border-[#8BA888]",
                label: "dark:text-gray-300",
                message: "dark:text-red-400 dark:bg-red-950/50 dark:border-red-800",
              },
            }}
            providers={[]}
            redirectTo={window.location.origin}
          />
        </div>

        <div className="pt-4 mt-6 text-xs text-center text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
          <p>
            By signing in, you agree to our Terms of Service and Privacy Policy
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
  );
};

export default AuthForm;
