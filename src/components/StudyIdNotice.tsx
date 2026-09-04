import React, { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "./ui/button";
import { StudySession, markSaveIdNoticeSeen } from "../lib/study-session";

interface StudyIdNoticeProps {
  studySession: StudySession;
  onDismiss: () => void;
}

/**
 * Shown once per participant, on their first visit.
 *
 * The participant ID is the only credential that reaches their conversation.
 * If a student closes the tab and loses the questionnaire link without having
 * noted the ID down, that conversation is unreachable for them, so it is
 * worth one interruption to say so.
 */
const StudyIdNotice = ({ studySession, onDismiss }: StudyIdNoticeProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(studySession.pid);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the ID is displayed to read regardless.
    }
  };

  const handleDismiss = () => {
    markSaveIdNoticeSeen(studySession.pid);
    onDismiss();
  };

  const CopyIcon = copied ? Check : Copy;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="study-notice-title"
        className="w-full max-w-md rounded-lg bg-white dark:bg-[#3A4140] p-6 shadow-xl border border-gray-200 dark:border-[#4A5654]"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center justify-center w-14 h-14 mb-4 rounded-full bg-gradient-to-br from-[#8BA888] to-[#4B9460] shadow-lg">
            <KeyRound className="w-7 h-7 text-white" />
          </div>

          <h2
            id="study-notice-title"
            className="text-lg font-semibold text-[#2C4A3E] dark:text-white"
          >
            This is your participant ID
          </h2>

          <button
            type="button"
            onClick={handleCopy}
            title="Copy participant ID"
            className="mt-4 flex items-center gap-3 px-5 py-3 rounded-md bg-[#4B9460]/10 dark:bg-[#8BA888]/10 border border-[#4B9460]/30 dark:border-[#8BA888]/30 hover:bg-[#4B9460]/20 dark:hover:bg-[#8BA888]/20 transition-colors"
          >
            <span className="text-2xl font-mono font-bold tracking-[0.3em] text-[#2C4A3E] dark:text-[#98C9A3]">
              {studySession.pid}
            </span>
            <CopyIcon className="h-4 w-4 opacity-60 text-[#2C4A3E] dark:text-[#98C9A3]" />
          </button>

          <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            Save it somewhere. If you close this tab and lose the link from the
            questionnaire, this ID is how you get back to this conversation.
          </p>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            It stays visible in the header while you chat.
          </p>

          <Button
            onClick={handleDismiss}
            className="w-full mt-6 bg-[#2C4A3E] hover:bg-[#8BA888] text-white dark:bg-[#8BA888] dark:hover:bg-[#98C9A3] dark:text-[#2F3635]"
          >
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudyIdNotice;
