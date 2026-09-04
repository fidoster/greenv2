import React, { useState, useEffect } from "react";
import AuthForm from "./AuthForm";
import ChatInterface from "./ChatInterface";
import { supabase } from "../lib/supabase";
import {
  StudySession,
  getActiveStudySession,
  recoverStudySessionFromUser,
  startStudySessionFromUrl,
  urlHasStudyParams,
} from "../lib/study-session";

interface HomeProps {
  initialAuthenticated?: boolean;
}

const Home = ({ initialAuthenticated = false }: HomeProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState(initialAuthenticated);
  const [isLoading, setIsLoading] = useState(true);
  const [studySession, setStudySession] = useState<StudySession | null>(null);
  const [studyError, setStudyError] = useState<string | null>(null);

  // Check if user is authenticated with Supabase
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      // Study entry: a valid 6-digit pid in the URL skips the login screen.
      // Anything else falls through to the normal flow below.
      if (urlHasStudyParams()) {
        try {
          const session = await startStudySessionFromUrl();
          if (cancelled) return;

          if (session) {
            setStudySession(session);
            setIsAuthenticated(true);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Study session could not be started:", error);
          if (cancelled) return;
          // Fall through to the login screen rather than stranding the
          // student on a dead page.
          setStudyError(
            error instanceof Error
              ? error.message
              : "Could not start your study session.",
          );
        }
      }

      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const authed = !!data.session;
      setIsAuthenticated(authed);

      // A returning participant may hold a session but no cached pid, for
      // example after closing the tab. Rebuild it so their ID stays visible
      // and their messages stay tagged.
      if (authed) {
        const recovered =
          getActiveStudySession() ?? (await recoverStudySessionFromUser());
        if (!cancelled && recovered) setStudySession(recovered);
      }

      if (!cancelled) setIsLoading(false);
    };

    checkAuth();

    // Set up auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
        if (!session) setStudySession(null);
      },
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = async () => {
    setIsAuthenticated(true);
    setStudyError(null);
    setStudySession(getActiveStudySession());
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#2F3635]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#8BA888]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-[#2F3635]">
      {!isAuthenticated ? (
        <div className="relative">
          <AuthForm
            onAuthSuccess={handleAuthSuccess}
            initialError={studyError}
          />
        </div>
      ) : (
        <ChatInterface studySession={studySession} />
      )}
    </div>
  );
};

export default Home;
