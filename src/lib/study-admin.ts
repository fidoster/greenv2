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
}

export interface StudySessionSummary {
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

/**
 * Load every study conversation with its messages, grouped per participant.
 * Study rows only: conversations with no pid belong to regular users.
 */
export async function getStudySessions(): Promise<{
  sessions: StudySessionSummary[];
  messages: StudyMessageRow[];
}> {
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id, pid, scenario, title, persona, created_at, updated_at")
    .not("pid", "is", null)
    .order("updated_at", { ascending: false });

  if (convError) throw convError;

  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("id, conversation_id, pid, scenario, sender, persona, content, created_at, model")
    .not("pid", "is", null)
    .order("created_at", { ascending: true });

  if (msgError) throw msgError;

  // Participants who signed in but never sent a message have no conversation
  // row at all. They matter -- that is the dropout signal -- so seed the list
  // from the registry first. The view omits auth_secret by construction.
  const { data: participants } = await supabase
    .from("study_participants_admin")
    .select("pid, scenario, created_at, last_seen_at");

  const allMessages = (messages ?? []) as StudyMessageRow[];

  // Group by pid rather than conversation: a participant who starts a new
  // chat should still appear as one study session.
  const byPid = new Map<string, StudySessionSummary>();

  for (const p of participants ?? []) {
    if (!p.pid) continue;
    byPid.set(p.pid, {
      pid: p.pid,
      scenario: p.scenario ?? null,
      conversationId: null,
      title: "—",
      advisors: [],
      messageCount: 0,
      participantMessages: 0,
      models: [],
      startedAt: p.created_at ?? null,
      lastActivityAt: p.last_seen_at ?? null,
    });
  }

  // Conversations arrive newest-first, so the first one seen per pid is the
  // most recent. Fill in the registry-seeded rows rather than skipping them.
  for (const conv of conversations ?? []) {
    if (!conv.pid) continue;
    const existing = byPid.get(conv.pid);

    if (existing) {
      if (existing.conversationId) continue; // already has a newer conversation
      existing.conversationId = conv.id;
      existing.title = conv.title || "Untitled";
      existing.scenario = existing.scenario ?? conv.scenario ?? null;
      if (conv.created_at) existing.startedAt = conv.created_at;
      continue;
    }

    byPid.set(conv.pid, {
      pid: conv.pid,
      scenario: conv.scenario ?? null,
      conversationId: conv.id,
      title: conv.title || "Untitled",
      advisors: [],
      messageCount: 0,
      participantMessages: 0,
      models: [],
      startedAt: conv.created_at ?? null,
      lastActivityAt: conv.updated_at ?? null,
    });
  }

  for (const msg of allMessages) {
    if (!msg.pid) continue;

    let session = byPid.get(msg.pid);
    if (!session) {
      // Message without a matching conversation row; still worth showing.
      session = {
        pid: msg.pid,
        scenario: msg.scenario ?? null,
        conversationId: msg.conversation_id,
        title: "Untitled",
        advisors: [],
        messageCount: 0,
        participantMessages: 0,
        models: [],
        startedAt: msg.created_at ?? null,
        lastActivityAt: msg.created_at ?? null,
      };
      byPid.set(msg.pid, session);
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

  const sessions = Array.from(byPid.values()).sort((a, b) =>
    (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""),
  );

  return { sessions, messages: allMessages };
}

/**
 * Delete every study conversation and message.
 *
 * Scoped to pid IS NOT NULL on both the client and in the RLS policy, so a
 * regular user's conversation cannot be removed here even by accident.
 */
export async function deleteAllStudyData(): Promise<{ deleted: number }> {
  const { data: toDelete, error: countError } = await supabase
    .from("conversations")
    .select("id")
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

  return { deleted: toDelete?.length ?? 0 };
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

/** One row per message: the shape you join against the Qualtrics export. */
export function messagesToCsv(messages: StudyMessageRow[]): string {
  const header = [
    "pid",
    "scenario",
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
