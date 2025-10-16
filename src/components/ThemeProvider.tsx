import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
  toggleTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// Export as a named function component for Fast Refresh compatibility
export const ThemeProvider = ({
  children,
  defaultTheme = "dark",
  storageKey = "greenbot-ui-theme",
  ...props
}: ThemeProviderProps) => {
  // Initialize theme state with the current theme from the HTML class
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return defaultTheme;
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
  });

  // Apply theme changes and sync with localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;

    // Ensure the current theme class is set
    root.classList.remove(theme === "dark" ? "light" : "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;

    // Save to localStorage
    localStorage.setItem(storageKey, theme);

    // Update the meta theme color
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute(
        "content",
        theme === "dark" ? "#0f172a" : "#ffffff",
      );
    }
  }, [theme, storageKey]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme);
    },
    toggleTheme: () => {
      setTheme(theme === "light" ? "dark" : "light");
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
};

// Export as a named function for Fast Refresh compatibility
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
