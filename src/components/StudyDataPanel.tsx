import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  MessageSquare,
  Layers,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ADVISOR_NAMES,
  StudyMessageRow,
  StudySessionSummary,
  deleteAllStudyData,
  deleteParticipant,
  downloadFile,
  getStudySessions,
  sessionKey,
  messagesToCsv,
  sessionsToCsv,
  sessionsToTranscript,
  timestampedName,
} from "../lib/study-admin";

const DELETE_CONFIRM_PHRASE = "DELETE ALL";

// Muted, distinguishable badge colours per advisor. Kept close to the
// palette each persona already uses in PersonaSelector.
const ADVISOR_STYLES: Record<string, string> = {
  GreenBot:
    "bg-[#98C9A3]/20 text-[#2C4A3E] dark:text-[#98C9A3] border-[#98C9A3]/40",
  "EcoLife Guide":
    "bg-[#8BA888]/20 text-[#4A5F48] dark:text-[#8BA888] border-[#8BA888]/40",
  "Waste Wizard":
    "bg-[#2C4A3E]/15 text-[#2C4A3E] dark:text-[#7FB891] border-[#2C4A3E]/30",
  "Nature Navigator":
    "bg-[#6AADCB]/20 text-[#2A6A88] dark:text-[#6AADCB] border-[#6AADCB]/40",
  "Power Sage":
    "bg-[#F6C344]/20 text-[#8A6A00] dark:text-[#F6C344] border-[#F6C344]/40",
  "Climate Guardian":
    "bg-[#C77DFF]/15 text-[#6B3FA0] dark:text-[#C9A0FF] border-[#C77DFF]/35",
};

function AdvisorBadge({ name }: { name: string }) {
  return (
    <Badge
      variant="outline"
      className={`font-normal text-[11px] px-1.5 py-0 ${
        ADVISOR_STYLES[name] ?? "bg-gray-100 dark:bg-gray-800"
      }`}
    >
      {name}
    </Badge>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-[#3A4140] bg-white dark:bg-[#2A3130] px-4 py-3">
      <div className="text-[#4B9460] dark:text-[#98C9A3]">{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-semibold text-gray-900 dark:text-white leading-tight">
          {value}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

const StudyDataPanel = () => {
  const [sessions, setSessions] = useState<StudySessionSummary[]>([]);
  const [messages, setMessages] = useState<StudyMessageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [scenarioFilter, setScenarioFilter] = useState<string>("all");
  const [advisorFilter, setAdvisorFilter] = useState<string>("all");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Single-participant erasure. Confirmed by typing the session code itself
  // rather than a generic phrase, so a mis-click on the wrong row cannot be
  // confirmed by muscle memory -- you have to read the code you are deleting.
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteTargetConfirm, setDeleteTargetConfirm] = useState("");
  const [isDeletingOne, setIsDeletingOne] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { sessions, messages } = await getStudySessions();
      setSessions(sessions);
      setMessages(messages);
    } catch (err) {
      console.error("Error loading study data:", err);
      setError(
        err instanceof Error ? err.message : "Could not load study data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (term && !s.pid.includes(term) && !s.title.toLowerCase().includes(term))
        return false;
      if (scenarioFilter !== "all" && String(s.scenario) !== scenarioFilter)
        return false;
      if (advisorFilter !== "all" && !s.advisors.includes(advisorFilter))
        return false;
      return true;
    });
  }, [sessions, search, scenarioFilter, advisorFilter]);

  // Keyed per participant AND scenario so an expanded row shows only that
  // scenario's transcript, not both concatenated.
  const messagesByKey = useMemo(() => {
    const map = new Map<string, StudyMessageRow[]>();
    for (const m of messages) {
      if (!m.pid) continue;
      const k = sessionKey(m.pid, m.scenario ?? null);
      const list = map.get(k);
      if (list) list.push(m);
      else map.set(k, [m]);
    }
    return map;
  }, [messages]);

  const stats = useMemo(
    () => ({
      participants: new Set(sessions.map((s) => s.pid)).size,
      sessions: sessions.length,
      scenario1: sessions.filter((s) => s.scenario === 1).length,
      scenario2: sessions.filter((s) => s.scenario === 2).length,
      messages: messages.length,
      // Sessions, not students: a student consents once, but completes both
      // scenarios, so this counts the rows that may be analysed.
      consented: sessions.filter((s) => s.consent === 1).length,
    }),
    [sessions, messages],
  );

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAllStudyData();
      setIsDeleteOpen(false);
      setDeleteConfirm("");
      setExpandedKey(null);
      await load();
    } catch (err) {
      console.error("Error deleting study data:", err);
      setError(
        err instanceof Error ? err.message : "Could not delete study data.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // How many rows this session code covers, so the confirmation can say
  // plainly that both scenarios go, not just the row that was clicked.
  const targetSessions = useMemo(
    () => (deleteTarget ? sessions.filter((s) => s.pid === deleteTarget) : []),
    [sessions, deleteTarget],
  );
  const targetMessageCount = useMemo(
    () =>
      deleteTarget ? messages.filter((m) => m.pid === deleteTarget).length : 0,
    [messages, deleteTarget],
  );

  const closeDeleteTarget = () => {
    setDeleteTarget(null);
    setDeleteTargetConfirm("");
  };

  const handleDeleteParticipant = async () => {
    if (!deleteTarget) return;
    setIsDeletingOne(true);
    setError(null);
    try {
      const result = await deleteParticipant(deleteTarget);
      setDeleteNotice(
        `Deleted session code ${result.pid}: ${result.messagesDeleted} ${
          result.messagesDeleted === 1 ? "message" : "messages"
        }, ${result.conversationsDeleted} ${
          result.conversationsDeleted === 1 ? "conversation" : "conversations"
        }${result.authUserDeleted ? " and their login" : ""}.`,
      );
      closeDeleteTarget();
      setExpandedKey(null);
      await load();
    } catch (err) {
      console.error("Error deleting participant:", err);
      setError(
        err instanceof Error ? err.message : "Could not delete this participant.",
      );
    } finally {
      setIsDeletingOne(false);
    }
  };

  // Exports follow the current filters, so a filtered view exports what is
  // on screen rather than silently dumping everything.
  //
  // Matched on pid AND scenario, not pid alone. Rows are per participant per
  // scenario, so matching on pid meant filtering to "Scenario 1" still
  // exported that participant's scenario 2 messages -- a file that looks
  // filtered but is not, which is the kind of thing you only discover after
  // analysing it.
  const visibleKeys = useMemo(
    () => new Set(filtered.map((s) => s.key)),
    [filtered],
  );
  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) => m.pid && visibleKeys.has(sessionKey(m.pid, m.scenario ?? null)),
      ),
    [messages, visibleKeys],
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#4B9460] dark:text-[#98C9A3]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {deleteNotice && (
        <div className="flex items-start justify-between gap-3 rounded-md border border-[#4B9460]/40 dark:border-[#98C9A3]/30 bg-[#4B9460]/10 dark:bg-[#98C9A3]/10 px-4 py-3 text-sm text-[#2C4A3E] dark:text-[#98C9A3]">
          <span>{deleteNotice}</span>
          <button
            type="button"
            onClick={() => setDeleteNotice(null)}
            className="text-xs underline opacity-70 hover:opacity-100 shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile
          icon={<Users className="h-5 w-5" />}
          label="Participants · unique codes"
          value={stats.participants}
        />
        <StatTile
          icon={<Layers className="h-5 w-5" />}
          label="Sessions · one per scenario"
          value={stats.sessions}
        />
        <StatTile
          icon={<MessageSquare className="h-5 w-5" />}
          label="Messages logged"
          value={stats.messages}
        />
        <StatTile
          icon={<span className="text-sm font-bold">S1</span>}
          label="Scenario 1 — EcoLine"
          value={stats.scenario1}
        />
        <StatTile
          icon={<span className="text-sm font-bold">S2</span>}
          label="Scenario 2 — Media"
          value={stats.scenario2}
        />
        <StatTile
          icon={<ShieldCheck className="h-5 w-5" />}
          label="Consented · usable as data"
          value={stats.consented}
        />
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg">Study sessions</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={load}
                className="gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={visibleMessages.length === 0}
                onClick={() =>
                  downloadFile(
                    timestampedName("greenbot-messages", "csv"),
                    messagesToCsv(visibleMessages),
                    "text/csv",
                  )
                }
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Messages CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filtered.length === 0}
                onClick={() =>
                  downloadFile(
                    timestampedName("greenbot-sessions", "csv"),
                    sessionsToCsv(filtered),
                    "text/csv",
                  )
                }
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Sessions CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={visibleMessages.length === 0}
                onClick={() =>
                  downloadFile(
                    timestampedName("greenbot-transcripts", "md"),
                    sessionsToTranscript(filtered, visibleMessages),
                    "text/markdown",
                  )
                }
                className="gap-1.5"
                title="Readable transcripts for qualitative reading and coding"
              >
                <FileText className="h-3.5 w-3.5" />
                Transcripts
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={filtered.length === 0}
                onClick={() =>
                  downloadFile(
                    timestampedName("greenbot-study", "json"),
                    JSON.stringify(
                      { sessions: filtered, messages: visibleMessages },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                JSON
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 pt-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search session code or title"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={scenarioFilter} onValueChange={setScenarioFilter}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Scenario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scenarios</SelectItem>
                <SelectItem value="1">Scenario 1 · EcoLine</SelectItem>
                <SelectItem value="2">Scenario 2 · Media</SelectItem>
              </SelectContent>
            </Select>
            <Select value={advisorFilter} onValueChange={setAdvisorFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Advisor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All advisors</SelectItem>
                {ADVISOR_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              {sessions.length === 0
                ? "No study sessions yet. They appear here once a participant sends their first message."
                : "No sessions match these filters."}
            </div>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-[#3A4140] text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-3 font-medium w-8"></th>
                    <th className="py-2 pr-3 font-medium">Participant</th>
                    <th className="py-2 pr-3 font-medium">Scenario</th>
                    <th className="py-2 pr-3 font-medium">Consent</th>
                    <th className="py-2 pr-3 font-medium">Advisors used</th>
                    <th className="py-2 pr-3 font-medium">Model</th>
                    <th className="py-2 pr-3 font-medium text-right">Msgs</th>
                    <th className="py-2 pr-3 font-medium">Started</th>
                    <th className="py-2 pr-3 font-medium">Last activity</th>
                    <th className="py-2 font-medium w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => {
                    const isOpen = expandedKey === s.key;
                    const transcript = messagesByKey.get(s.key) ?? [];
                    // Rows are sorted with a participant's scenarios adjacent,
                    // so a repeat of the previous pid is the same person's
                    // second session. Showing the ID once makes "2
                    // participants, 3 sessions" read correctly at a glance.
                    const continuesParticipant =
                      i > 0 && filtered[i - 1].pid === s.pid;
                    const sessionsForPid = filtered.filter(
                      (o) => o.pid === s.pid,
                    ).length;

                    return (
                      <Fragment key={s.key}>
                        <tr
                          onClick={() => setExpandedKey(isOpen ? null : s.key)}
                          className="border-b border-gray-100 dark:border-[#333B39] hover:bg-gray-50 dark:hover:bg-[#2C4A3E]/30 cursor-pointer"
                        >
                          <td className="py-2.5 pr-3 text-gray-400">
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td
                            className={`py-2.5 pr-3 ${
                              continuesParticipant
                                ? "border-l-2 border-[#4B9460]/40 dark:border-[#98C9A3]/30 pl-2"
                                : ""
                            }`}
                          >
                            {continuesParticipant ? (
                              <span
                                className="font-mono tracking-wider text-gray-400 dark:text-gray-600"
                                title={`Same participant as the row above (${s.pid})`}
                              >
                                ↳ {s.pid}
                              </span>
                            ) : (
                              <span className="font-mono font-semibold tracking-wider text-[#2C4A3E] dark:text-[#98C9A3]">
                                {s.pid}
                                {sessionsForPid > 1 && (
                                  <span className="ml-1.5 font-sans text-[10px] font-normal text-gray-500 dark:text-gray-400">
                                    ×{sessionsForPid}
                                  </span>
                                )}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            {s.scenario ? (
                              <Badge
                                variant="outline"
                                className="font-normal text-[11px] px-1.5 py-0"
                              >
                                {s.scenario === 1 ? "1 · EcoLine" : "2 · Media"}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          {/* Declining the study does not remove anyone from
                              this table: the activity is compulsory and the
                              discussion is logged either way. This column is
                              what says whether the row may be analysed. */}
                          <td className="py-2.5 pr-3">
                            {s.consent === 1 ? (
                              <Badge
                                variant="outline"
                                className="font-normal text-[11px] px-1.5 py-0 border-[#4B9460]/50 text-[#2C4A3E] dark:text-[#98C9A3] dark:border-[#98C9A3]/40"
                              >
                                Yes
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="font-normal text-[11px] px-1.5 py-0 border-gray-300 text-gray-500 dark:border-gray-600 dark:text-gray-400"
                              >
                                No
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {s.advisors.length > 0 ? (
                                s.advisors.map((a) => (
                                  <AdvisorBadge key={a} name={a} />
                                ))
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex flex-wrap gap-1">
                              {s.models.length > 0 ? (
                                s.models.map((m) => (
                                  <Badge
                                    key={m}
                                    variant="outline"
                                    // More than one model means a failover
                                    // happened mid-session, which matters when
                                    // comparing transcripts.
                                    className={`font-mono font-normal text-[10px] px-1.5 py-0 ${
                                      s.models.length > 1
                                        ? "border-amber-400/60 text-amber-700 dark:text-amber-400 bg-amber-400/10"
                                        : ""
                                    }`}
                                  >
                                    {m}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-gray-600 dark:text-gray-300">
                            {s.participantMessages}
                            <span className="text-gray-400">
                              /{s.messageCount}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {formatDateTime(s.startedAt)}
                          </td>
                          <td className="py-2.5 pr-3 whitespace-nowrap text-gray-600 dark:text-gray-300">
                            {formatDateTime(s.lastActivityAt)}
                          </td>
                          <td className="py-2.5">
                            <button
                              type="button"
                              // The row itself toggles the transcript, so the
                              // click must not bubble or deleting would also
                              // expand what is about to disappear.
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteNotice(null);
                                setDeleteTargetConfirm("");
                                setDeleteTarget(s.pid);
                              }}
                              title={`Delete session code ${s.pid} and all its data`}
                              aria-label={`Delete session code ${s.pid}`}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>

                        {isOpen && (
                          <tr>
                            <td
                              colSpan={10}
                              className="bg-gray-50 dark:bg-[#232927] px-4 py-4"
                            >
                              <div className="max-h-[420px] overflow-y-auto space-y-3 pr-2">
                                {transcript.length === 0 ? (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    No messages recorded for this participant.
                                  </p>
                                ) : (
                                  transcript.map((m) => (
                                    <div
                                      key={m.id}
                                      className={`flex flex-col gap-1 ${
                                        m.sender === "user"
                                          ? "items-end"
                                          : "items-start"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                        <span className="font-medium">
                                          {m.sender === "user"
                                            ? "Participant"
                                            : m.persona || "Advisor"}
                                        </span>
                                        <span>
                                          {formatDateTime(m.created_at)}
                                        </span>
                                        {m.model && (
                                          <span className="font-mono opacity-70">
                                            {m.model}
                                          </span>
                                        )}
                                      </div>
                                      <div
                                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                                          m.sender === "user"
                                            ? "bg-[#4B9460] text-white"
                                            : "bg-white dark:bg-[#2A3130] border border-gray-200 dark:border-[#3A4140] text-gray-800 dark:text-gray-100"
                                        }`}
                                      >
                                        {m.content}
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-red-200 dark:border-red-900/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Danger zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Permanently delete every study conversation and message. Regular
            user accounts and their chats are not affected — the database
            policy only permits deleting rows that carry a session code.
          </p>

          {!isDeleteOpen ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={sessions.length === 0}
              onClick={() => setIsDeleteOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete all study conversations
            </Button>
          ) : (
            <div className="rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
              <p className="text-sm text-red-800 dark:text-red-300">
                This deletes <strong>{stats.sessions}</strong> study{" "}
                {stats.sessions === 1 ? "session" : "sessions"} across{" "}
                <strong>{stats.participants}</strong>{" "}
                {stats.participants === 1 ? "participant" : "participants"}, and{" "}
                <strong>{stats.messages}</strong> messages. It cannot be undone.
              </p>
              <div className="space-y-1.5">
                <label
                  htmlFor="delete-confirm"
                  className="block text-xs font-medium text-red-800 dark:text-red-300"
                >
                  Type <code className="font-mono">{DELETE_CONFIRM_PHRASE}</code>{" "}
                  to confirm
                </label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirm}
                  autoComplete="off"
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="h-9 max-w-xs bg-white dark:bg-[#2A3130]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    deleteConfirm !== DELETE_CONFIRM_PHRASE || isDeleting
                  }
                  onClick={handleDeleteAll}
                  className="gap-1.5"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  Delete permanently
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isDeleting}
                  onClick={() => {
                    setIsDeleteOpen(false);
                    setDeleteConfirm("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single-participant erasure.
          Separate from the danger zone because this is the routine one: a
          student who withdraws, or a test code that should not reach the
          analysis. It removes the participant completely, so there is nothing
          left to re-identify or accidentally export. */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-participant-title"
            className="w-full max-w-md rounded-lg bg-white dark:bg-[#2A3130] p-6 shadow-xl border border-red-200 dark:border-red-900/50 space-y-4"
          >
            <h3
              id="delete-participant-title"
              className="text-base font-semibold flex items-center gap-2 text-red-700 dark:text-red-400"
            >
              <AlertTriangle className="h-4 w-4" />
              Delete session code {deleteTarget}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Removes{" "}
              <strong>
                {targetSessions.length}{" "}
                {targetSessions.length === 1 ? "session" : "sessions"}
              </strong>{" "}
              {targetSessions.length > 1 && (
                <>
                  (scenario{" "}
                  {targetSessions
                    .map((t) => t.scenario ?? "—")
                    .join(" and ")}
                  ){" "}
                </>
              )}
              and <strong>{targetMessageCount}</strong>{" "}
              {targetMessageCount === 1 ? "message" : "messages"}, along with
              this participant's login. It cannot be undone.
            </p>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use this for a student who withdraws, or to clear a test code.
              Other participants are not affected.
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="delete-participant-confirm"
                className="block text-xs font-medium text-red-800 dark:text-red-300"
              >
                Type <code className="font-mono">{deleteTarget}</code> to
                confirm
              </label>
              <Input
                id="delete-participant-confirm"
                value={deleteTargetConfirm}
                autoComplete="off"
                inputMode="numeric"
                maxLength={6}
                onChange={(e) =>
                  setDeleteTargetConfirm(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="h-9 max-w-[10rem] font-mono tracking-widest bg-white dark:bg-[#232927]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteTargetConfirm !== deleteTarget || isDeletingOne}
                onClick={handleDeleteParticipant}
                className="gap-1.5"
              >
                {isDeletingOne ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Delete participant
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={isDeletingOne}
                onClick={closeDeleteTarget}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyDataPanel;
