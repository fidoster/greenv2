// Admin-side reads over study data.
//
// Every query here depends on the admin policies added in
// 20260904000003_admin_study_data_access.sql. For a non-admin these return
// empty rather than erroring, because RLS filters rows rather than refusing
// the statement -- so an empty dashboard means "not an admin", not "no data".

import { supabase } from "./supabase";

export interface StudyMessageRow {
  id: string;
  conversation_id: string | null;
  pid: string | null;
  scenario: number | null;
  sender: string;
  persona: string | null;
  content: string;
  created_at: string | null;
  model: string | null;
  /** 1 = usable as research data, 0 = coursework only. Never null. */
  consent: number;
}

export interface StudySessionSummary {
  /** Unique per participant AND scenario: participants complete both. */
  key: string;
  pid: string;
  scenario: number | null;
  conversationId: string | null;
  title: string;
  /** Distinct advisors used, in first-use order. */
  advisors: string[];
  messageCount: number;
  participantMessages: number;
  /** Distinct models that answered, e.g. after a failover to Grok. */
  models: string[];
  /**
   * 1 when the student agreed their data may be used as research data.
   *
   * Taken from the participant registry, which holds the answer they gave on
   * the questionnaire. A session with no registry row falls back to what its
   * rows are tagged with, and to 0 when nothing says otherwise.
   */
  consent: number;
  startedAt: string | null;
  lastActivityAt: string | null;
}

/** Display names of every advisor, general first. */
export const ADVISOR_NAMES = [
  "GreenBot",
  "EcoLife Guide",
  "Waste Wizard",
  "Nature Navigator",
  "Power Sage",
  "Climate Guardian",
] as const;

// Supabase caps REST responses at a server-side maximum (1,000 rows by
// default). A study of 245 students produces several thousand messages, so an
// unpaginated read would silently return the first page and stop -- an export
// quietly missing most of the data, with no error to notice.
//
// Pages until a request comes back empty, advancing by the number of rows
// ACTUALLY returned rather than by the page size. If the server's cap is lower
// than the page size, advancing by page size would skip everything in between.
const PAGE_SIZE = 1000;
const MAX_PAGES = 500; // ~500k rows; a guard against an unterminated loop

async function fetchAllRows<T>(
  buildQuery: () => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>;
  },
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    from += data.length;
  }

  return rows;
}

/** One row per participant per scenario, since participants complete both. */
export function sessionKey(pid: string, scenario: number | null): string {
  return `${pid}::${scenario ?? "none"}`;
}

/**
 * Load every study conversation with its messages, grouped by participant AND
 * scenario. Study rows only: conversations with no pid belong to regular users.
 */
export async function getStudySessions(): Promise<{
  sessions: StudySessionSummary[];
  messages: StudyMessageRow[];
}> {
  // The secondary sort on id matters: range paging over a non-unique order can
  // skip or repeat rows when timestamps tie.
  const conversations = await fetchAllRows<any>(() =>
    supabase
      .from("conversations")
      .select(
        "id, pid, scenario, title, persona, created_at, updated_at, consent",
      )
      .not("pid", "is", null)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true }),
  );

  const messages = await fetchAllRows<StudyMessageRow>(() =>
    supabase
      .from("messages")
      .select(
        "id, conversation_id, pid, scenario, sender, persona, content, created_at, model, consent",
      )
      .not("pid", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  );

  // Participants who signed in but never sent a message have no conversation
  // row at all. They matter -- that is the dropout signal -- so seed the list
  // from the registry first. The view omits auth_secret by construction.
  const participants = await fetchAllRows<any>(() =>
    supabase
      .from("study_participants_admin")
      .select("pid, scenario, created_at, last_seen_at, consent")
      .order("pid", { ascending: true }),
  );

  const allMessages = messages;

  // Keyed by pid AND scenario. Grouping by pid alone would merge a
  // participant's two scenarios into one row and blend their transcripts,
  // which is precisely the comparison the study depends on keeping apart.
  const byPid = new Map<string, StudySessionSummary>();

  for (const p of participants ?? []) {
    if (!p.pid) continue;
    byPid.set(sessionKey(p.pid, p.scenario ?? null), {
      key: sessionKey(p.pid, p.scenario ?? null),
      pid: p.pid,
      scenario: p.scenario ?? null,
      conversationId: null,
      title: "—",
      advisors: [],
      messageCount: 0,
      participantMessages: 0,
      models: [],
      // The registry is the authoritative record of what the student
      // answered, so it wins over whatever individual rows are tagged with.
      consent: p.consent ?? 0,
      startedAt: p.created_at ?? null,
      lastActivityAt: p.last_seen_at ?? null,
    });
  }

  // Conversations arrive newest-first, so the first one seen per pid is the
  // most recent. Fill in the registry-seeded rows rather than skipping them.
  for (const conv of conversations ?? []) {
    if (!conv.pid) continue;
    const key = sessionKey(conv.pid, conv.scenario ?? null);
    const existing = byPid.get(key);

    if (existing) {
      if (existing.conversationId) continue; // already has a newer conversation
      existing.conversationId = conv.id;
      existing.title = conv.title || "Untitled";
      existing.scenario = existing.scenario ?? conv.scenario ?? null;
      if (conv.created_at) existing.startedAt = conv.created_at;
      continue;
    }

    byPid.set(key, {
      key,
      pid: conv.pid,
      scenario: conv.scenario ?? null,
      conversationId: conv.id,
      title: conv.title || "Untitled",
      advisors: [],
      messageCount: 0,
      participantMessages: 0,
      models: [],
      consent: conv.consent ?? 0,
      startedAt: conv.created_at ?? null,
      lastActivityAt: conv.updated_at ?? null,
    });
  }

  for (const msg of allMessages) {
    if (!msg.pid) continue;

    const msgKey = sessionKey(msg.pid, msg.scenario ?? null);
    let session = byPid.get(msgKey);
    if (!session) {
      // Message without a matching conversation row; still worth showing.
      session = {
        key: msgKey,
        pid: msg.pid,
        scenario: msg.scenario ?? null,
        conversationId: msg.conversation_id,
        title: "Untitled",
        advisors: [],
        messageCount: 0,
        participantMessages: 0,
        models: [],
        consent: msg.consent ?? 0,
        startedAt: msg.created_at ?? null,
        lastActivityAt: msg.created_at ?? null,
      };
      byPid.set(msgKey, session);
    }

    session.messageCount += 1;
    if (msg.sender === "user") session.participantMessages += 1;

    // Only bot messages carry a persona, and it is the advisor that replied.
    if (msg.persona && !session.advisors.includes(msg.persona)) {
      session.advisors.push(msg.persona);
    }

    if (msg.model && !session.models.includes(msg.model)) {
      session.models.push(msg.model);
    }

    if (
      msg.created_at &&
      (!session.lastActivityAt || msg.created_at > session.lastActivityAt)
    ) {
      session.lastActivityAt = msg.created_at;
    }
    if (
      msg.created_at &&
      (!session.startedAt || msg.created_at < session.startedAt)
    ) {
      session.startedAt = msg.created_at;
    }
  }

  // Sort by participant (most recently active first), then scenario, so a
  // participant's two rows sit together and read 1 then 2.
  const latestByPid = new Map<string, string>();
  for (const s of byPid.values()) {
    const cur = latestByPid.get(s.pid) ?? "";
    if ((s.lastActivityAt ?? "") > cur) latestByPid.set(s.pid, s.lastActivityAt ?? "");
  }

  const sessions = Array.from(byPid.values()).sort((a, b) => {
    if (a.pid !== b.pid) {
      return (latestByPid.get(b.pid) ?? "").localeCompare(
        latestByPid.get(a.pid) ?? "",
      );
    }
    return (a.scenario ?? 0) - (b.scenario ?? 0);
  });

  return { sessions, messages: allMessages };
}

/**
 * Delete every study conversation and message.
 *
 * Scoped to pid IS NOT NULL on both the client and in the RLS policy, so a
 * regular user's conversation cannot be removed here even by accident.
 */
export async function deleteAllStudyData(): Promise<{ deleted: number }> {
  // head + exact count, so the number is not itself capped by the row limit.
  const { count: toDelete, error: countError } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .not("pid", "is", null);

  if (countError) throw countError;

  // Messages first: they are cascade-deleted anyway, but deleting them
  // explicitly means a partial failure cannot orphan rows that still carry
  // participant content.
  const { error: msgError } = await supabase
    .from("messages")
    .delete()
    .not("pid", "is", null);

  if (msgError) throw msgError;

  const { error: convError } = await supabase
    .from("conversations")
    .delete()
    .not("pid", "is", null);

  if (convError) throw convError;

  return { deleted: toDelete ?? 0 };
}

export interface DeleteParticipantResult {
  pid: string;
  messagesDeleted: number;
  conversationsDeleted: number;
  authUserDeleted: boolean;
}

/**
 * Erase one participant completely: their messages, their conversations,
 * their registry row and their auth user.
 *
 * This cannot be done from the browser. study_participants holds the
 * auth_secret and is service-role only, and removing an auth user needs the
 * admin API, so the work happens in the study-admin Edge Function, which
 * re-checks the caller's admin role server-side.
 *
 * Scoped to one session code, and it removes BOTH scenarios: a participant
 * with half their data deleted is worse than either keeping or removing them
 * outright, since the within-subjects comparison is the point.
 */
export async function deleteParticipant(
  pid: string,
): Promise<DeleteParticipantResult> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  // The caller's own token, not the anon key: the function identifies the
  // admin from it and refuses anyone else.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Your session has expired. Please sign in again.");

  const response = await fetch(`${supabaseUrl}/functions/v1/study-admin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: "deleteParticipant", pid }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Could not delete this participant.");
  }

  return payload as DeleteParticipantResult;
}

// ---------------------------------------------------------------
// Export
// ---------------------------------------------------------------

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote whenever the value could break the row, and double any quotes.
  if (/[",\r\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

/** Words, for the engagement measures a chat study usually wants. */
function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * One row per message: the shape you join against the Qualtrics export.
 *
 * Every message is exported, including those from students who declined.
 * Their discussions are coursework and belong in the log; consent is the
 * column that decides what may be analysed. Filter on consent = 1 rather
 * than assuming the file is already restricted to it.
 *
 * turn_index matters more than it looks. created_at is written from the
 * BROWSER's clock, not the server's, so it is only as trustworthy as the
 * student's device: two messages a second apart can tie, or invert, and
 * across 245 devices the absolute times are not comparable. turn_index is
 * the order the conversation actually happened in, per participant per
 * scenario. Sequence it on; use created_at for wall-clock timing only, and
 * treat cross-participant timing as approximate.
 */
export function messagesToCsv(messages: StudyMessageRow[]): string {
  const header = [
    "pid",
    "scenario",
    "consent",
    "turn_index",
    "message_id",
    "conversation_id",
    "timestamp",
    "sender",
    "advisor",
    "model",
    "content_chars",
    "content_words",
    "content",
  ];

  // Input arrives ordered by created_at then id, so a running counter per
  // session reproduces the order the transcript is read in.
  const turnByKey = new Map<string, number>();

  const rows = messages.map((m) => {
    const key = sessionKey(m.pid ?? "", m.scenario ?? null);
    const turn = (turnByKey.get(key) ?? 0) + 1;
    turnByKey.set(key, turn);

    return [
      m.pid,
      m.scenario,
      // Numeric rather than yes/no: this is the column you filter and cross
      // tabulate on, and 0/1 imports cleanly into SPSS, R and Excel alike.
      m.consent ?? 0,
      turn,
      m.id,
      m.conversation_id,
      m.created_at,
      m.sender,
      m.persona ?? "",
      m.model ?? "",
      m.content.length,
      wordCount(m.content),
      m.content,
    ]
      .map(csvCell)
      .join(",");
  });

  return [header.join(","), ...rows].join("\r\n");
}

/** Minutes between first and last activity, blank when it cannot be known. */
function durationMinutes(from: string | null, to: string | null): string {
  if (!from || !to) return "";
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "";
  return ((end - start) / 60000).toFixed(1);
}

/**
 * One row per participant per scenario, for quick counts.
 *
 * A row with messages_total = 0 is a real finding, not padding: it is a
 * student who opened GreenBot and never sent anything, which is the dropout
 * signal. Those rows come from the participant registry, so they survive
 * even though there is no conversation to join to.
 */
export function sessionsToCsv(sessions: StudySessionSummary[]): string {
  const header = [
    "pid",
    "scenario",
    "consent",
    "conversation_id",
    "title",
    "advisors_used",
    "advisor_count",
    "models_used",
    "messages_total",
    "messages_from_participant",
    "messages_from_advisor",
    "started_at",
    "last_activity_at",
    "duration_minutes",
  ];

  const rows = sessions.map((s) =>
    [
      s.pid,
      s.scenario,
      s.consent ?? 0,
      s.conversationId ?? "",
      s.title,
      s.advisors.join(" | "),
      s.advisors.length,
      s.models.join(" | "),
      s.messageCount,
      s.participantMessages,
      s.messageCount - s.participantMessages,
      s.startedAt,
      s.lastActivityAt,
      durationMinutes(s.startedAt, s.lastActivityAt),
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\r\n");
}

// The dilemmas as students meet them in the questionnaire. Spelled out in
// full here because the transcript header is read months later, when
// "scenario 1" on its own will not mean anything.
const SCENARIO_LABELS: Record<number, string> = {
  1: "EcoLine campaign at UrbanThread",
  2: "Media plan at GreenGadget",
};

/**
 * The transcripts as readable Markdown, one section per participant per
 * scenario.
 *
 * The CSV is what you compute on; this is what you actually read. Qualitative
 * coding from a spreadsheet cell means scrolling a 2,000-character reply
 * inside a 20-pixel row, and the turn order is only as clear as your sort.
 * Here a conversation reads top to bottom the way it happened.
 */
export function sessionsToTranscript(
  sessions: StudySessionSummary[],
  messages: StudyMessageRow[],
): string {
  const byKey = new Map<string, StudyMessageRow[]>();
  for (const m of messages) {
    if (!m.pid) continue;
    const key = sessionKey(m.pid, m.scenario ?? null);
    const list = byKey.get(key);
    if (list) list.push(m);
    else byKey.set(key, [m]);
  }

  const participants = new Set(sessions.map((s) => s.pid)).size;
  const out: string[] = [
    "# GreenBot study transcripts",
    "",
    `Exported ${new Date().toISOString()}`,
    "",
    `${sessions.length} ${sessions.length === 1 ? "session" : "sessions"} · ` +
      `${participants} ${participants === 1 ? "participant" : "participants"} · ` +
      `${messages.length} messages`,
    "",
    "`Consent: no` marks coursework that may not be used as research data.",
    "",
    "---",
    "",
  ];

  for (const s of sessions) {
    const transcript = byKey.get(s.key) ?? [];
    const scenarioLabel =
      s.scenario && SCENARIO_LABELS[s.scenario]
        ? `Scenario ${s.scenario} — ${SCENARIO_LABELS[s.scenario]}`
        : "Scenario unknown";

    out.push(`## ${s.pid} · ${scenarioLabel}`);
    out.push("");
    out.push(`- Consent: ${s.consent === 1 ? "yes" : "no"}`);
    out.push(`- Advisors: ${s.advisors.length ? s.advisors.join(", ") : "—"}`);
    out.push(`- Models: ${s.models.length ? s.models.join(", ") : "—"}`);
    out.push(
      `- Messages: ${s.messageCount} (${s.participantMessages} from the participant)`,
    );
    out.push(`- Started: ${s.startedAt ?? "—"}`);
    out.push(`- Last activity: ${s.lastActivityAt ?? "—"}`);
    const mins = durationMinutes(s.startedAt, s.lastActivityAt);
    if (mins) out.push(`- Duration: ${mins} minutes`);
    out.push("");

    if (transcript.length === 0) {
      out.push(
        "_No messages. This participant opened GreenBot but never sent anything._",
      );
      out.push("");
    } else {
      transcript.forEach((m, i) => {
        const who =
          m.sender === "user" ? "Participant" : m.persona || "Advisor";
        const model = m.model ? ` · ${m.model}` : "";
        out.push(`**${i + 1}. ${who}**  _(${m.created_at ?? "no timestamp"}${model})_`);
        out.push("");
        // Quoted so a student's own Markdown -- a stray #, or a list --
        // cannot restructure the document around it.
        for (const line of m.content.split("\n")) out.push(`> ${line}`);
        out.push("");
      });
    }

    out.push("---");
    out.push("");
  }

  return out.join("\n");
}

export function downloadFile(
  filename: string,
  contents: string,
  mimeType: string,
) {
  // BOM so Excel opens UTF-8 content correctly, which matters for any
  // non-ASCII characters students type.
  const blob = new Blob([`﻿${contents}`], {
    type: `${mimeType};charset=utf-8`,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function timestampedName(prefix: string, extension: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `${prefix}-${stamp}.${extension}`;
}
