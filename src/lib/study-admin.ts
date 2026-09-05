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

/**
 * One row per message: the shape you join against the Qualtrics export.
 *
 * Every message is exported, including those from students who declined.
 * Their discussions are coursework and belong in the log; consent is the
 * column that decides what may be analysed. Filter on consent = 1 rather
 * than assuming the file is already restricted to it.
 */
export function messagesToCsv(messages: StudyMessageRow[]): string {
  const header = [
    "pid",
    "scenario",
    "consent",
    "conversation_id",
    "timestamp",
    "sender",
    "advisor",
    "model",
    "content",
  ];

  const rows = messages.map((m) =>
    [
      m.pid,
      m.scenario,
      // Numeric rather than yes/no: this is the column you filter and cross
      // tabulate on, and 0/1 imports cleanly into SPSS, R and Excel alike.
      m.consent ?? 0,
      m.conversation_id,
      m.created_at,
      m.sender,
      m.persona ?? "",
      m.model ?? "",
      m.content,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\r\n");
}

/** One row per participant, for quick counts. */
export function sessionsToCsv(sessions: StudySessionSummary[]): string {
  const header = [
    "pid",
    "scenario",
    "consent",
    "advisors_used",
    "models_used",
    "messages_total",
    "messages_from_participant",
    "started_at",
    "last_activity_at",
  ];

  const rows = sessions.map((s) =>
    [
      s.pid,
      s.scenario,
      s.consent ?? 0,
      s.advisors.join(" | "),
      s.models.join(" | "),
      s.messageCount,
      s.participantMessages,
      s.startedAt,
      s.lastActivityAt,
    ]
      .map(csvCell)
      .join(","),
  );

  return [header.join(","), ...rows].join("\r\n");
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
