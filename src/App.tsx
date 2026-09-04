import { Suspense, lazy, useEffect, useState } from "react";
import { Routes, Route, useRoutes, Navigate } from "react-router-dom";
import Home from "./components/home";
import routes from "tempo-routes";
import { ThemeProvider } from "./components/ThemeProvider";
import { supabase } from "./lib/supabase";

// Lazy load the AdminPanel component
const AdminPanel = lazy(() => import("./components/AdminPanel"));

// Admin-only route.
//
// This previously checked only that a session existed, which was enough when
// every session belonged to a registered user. Study participants and guests
// also hold sessions, so the admin role is now verified explicitly.
const AdminOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAllowed, setIsAllowed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;

        if (!userId) {
          if (!cancelled) setIsAllowed(false);
          return;
        }

        const { data: userData, error } = await supabase
          .from("users")
          .select("role")
          .eq("id", userId)
          .maybeSingle();

        if (!cancelled) {
          setIsAllowed(!error && userData?.role === "admin");
        }
      } catch (error) {
        console.error("Error checking admin access:", error);
        if (!cancelled) setIsAllowed(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    checkAccess();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      setIsLoading(true);
      checkAccess();
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#8BA888]"></div>
      </div>
    );
  }

  return isAllowed ? children : <Navigate to="/" replace />;
};

function App() {
  // Get the current URL to check for query parameters
  const currentUrl = window.location.href;
  const hasFrameworkParam = currentUrl.includes('framework=VITE');

  // Use the useRoutes hook for Tempo routes
  const tempoRoutes =
    import.meta.env.VITE_TEMPO === "true" ? useRoutes(routes) : null;

  // Clear localStorage chat data when user signs in/out
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          // Clear unauthenticated chat data when authentication state changes
          localStorage.removeItem('unauthenticatedChats');
          // Also clear deleted chats list to prevent hiding Supabase conversations
          localStorage.removeItem('deletedChats');
          console.log('Cleared localStorage chat data due to auth state change:', event);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="greenbot-ui-theme">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#8BA888]"></div>
          </div>
        }
      >
        {/* Tempo routes are handled separately */}
        {tempoRoutes}

        <Routes>
          <Route path="/" element={<Home />} />
          {/* Use a single route for /admin that will work with or without query parameters */}
          <Route
            path="/admin"
            element={
              <AdminOnlyRoute>
                <AdminPanel />
              </AdminOnlyRoute>
            }
          />
          {import.meta.env.VITE_TEMPO === "true" && (
            <Route path="/tempobook/*" element={null} />
          )}
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </ThemeProvider>
  );
}

export default App;
