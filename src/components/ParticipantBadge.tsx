import React, { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "../lib/utils";
import { StudySession } from "../lib/study-session";

interface ParticipantBadgeProps {
  studySession: StudySession;
  /** "pill" for the chat header, "block" for the sidebar. */
  variant?: "pill" | "block";
  className?: string;
}

/**
 * Shows the participant ID. Always visible at every breakpoint: it is both
 * how a student confirms they are in the right session and the only way back
 * into their conversation later, so it must never be hidden behind a menu.
 */
const ParticipantBadge = ({
  studySession,
  variant = "pill",
  className,
}: ParticipantBadgeProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(studySession.pid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the ID is on screen to read regardless.
    }
  };

  const CopyIcon = copied ? Check : Copy;

  if (variant === "block") {
    return (
      <div
        className={cn(
          "px-2 sm:px-3 py-1.5 sm:py-2 rounded-md bg-[#4B9460]/10 dark:bg-[#8BA888]/10 border border-[#4B9460]/30 dark:border-[#8BA888]/30",
          className,
        )}
      >
        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">
          Participant ID
        </div>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy participant ID"
          className="flex items-center gap-2 text-sm sm:text-base font-mono font-semibold tracking-widest text-[#2C4A3E] dark:text-[#98C9A3] hover:opacity-80 transition-opacity"
        >
          {studySession.pid}
          <CopyIcon className="h-3.5 w-3.5 opacity-60" />
        </button>
        <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Scenario {studySession.scenario}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Participant ID ${studySession.pid} — scenario ${studySession.scenario}. Click to copy.`}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#4B9460]/30 dark:border-[#8BA888]/30 bg-[#4B9460]/10 dark:bg-[#8BA888]/10 hover:bg-[#4B9460]/20 dark:hover:bg-[#8BA888]/20 transition-colors shrink-0",
        className,
      )}
    >
      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400 hidden sm:inline">
        ID
      </span>
      <span className="text-xs sm:text-sm font-mono font-semibold tracking-widest text-[#2C4A3E] dark:text-[#98C9A3]">
        {studySession.pid}
      </span>
      <CopyIcon className="h-3 w-3 opacity-50 text-[#2C4A3E] dark:text-[#98C9A3]" />
    </button>
  );
};

export default ParticipantBadge;
