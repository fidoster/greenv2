import { Moon, Sun } from "lucide-react";
import { Button } from "./ui/button";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="relative group">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        className="relative rounded-full bg-[#98C9A3]/10 hover:bg-[#98C9A3]/20 transition-all duration-200 group-hover:scale-110"
        aria-label="Toggle theme"
      >
        {theme === "light" ? (
          <Sun className="h-5 w-5 text-[#4B9460]" />
        ) : (
          <Moon className="h-5 w-5 text-[#98C9A3]" />
        )}
      </Button>
      <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap text-xs bg-[#4B9460] dark:bg-[#98C9A3] text-white px-2 py-1 rounded-md">
        {theme === "light" ? "Dark mode" : "Light mode"}
      </div>
    </div>
  );
}
