// Study mode session handling.
//
// A participant arrives either from Qualtrics (/?pid=482913&scenario=1) or by
// typing their participant ID at greenbot.live. Both paths call the
// study-auth Edge Function, which returns a session for the one auth user
// that belongs to that pid. From then on the app is normally authenticated,
// so every existing RLS policy applies unchanged.

import { supabase } from "./supabase";

export interface StudySession {
  pid: string;
  scenario: 1 | 2;
}

export const PID_PATTERN = /^[0-9]{6}$/;

// Synthetic address used by study-auth. Kept in sync with the Edge Function.
const PARTICIPANT_EMAIL_DOMAIN = "participants.greenbot.study";

const STORAGE_KEY = "greenbot-study-session";
const NOTICE_KEY_PREFIX = "greenbot-study-notice-";

// Cached so chat-service can tag writes synchronously, without threading the
// session through every call site.
let activeSession: StudySession | null = null;

function isValidPid(value: unknown): value is string {
  return typeof value === "string" && PID_PATTERN.test(value);
}

function toScenario(value: unknown): 1 | 2 | null {
  const n = Number(value);
  return n === 1 || n === 2 ? n : null;
}

/**
 * Read and validate study parameters from the current URL.
 * Anything that is not exactly 6 digits is ignored, so /?pid=abc and /?pid=12
 * fall through to the normal login screen.
 */
export function readStudyParamsFromUrl(): {
  pid: string | null;
  scenario: 1 | 2 | null;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawPid = params.get("pid");
    const pid = isValidPid(rawPid) ? rawPid : null;
    return { pid, scenario: toScenario(params.get("scenario")) };
  } catch {
    return { pid: null, scenario: null };
  }
}

/** True when the URL carries a well-formed participant ID. */
export function urlHasStudyParams(): boolean {
  return readStudyParamsFromUrl().pid !== null;
}

function readStored(): StudySession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const scenario = toScenario(parsed?.scenario);
    if (!isValidPid(parsed?.pid) || scenario === null) return null;
    return { pid: parsed.pid, scenario };
  } catch {
    return null;
  }
}

function writeStored(session: StudySession) {
  activeSession = session;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Private browsing can refuse storage. The session still works for this
    // page load, and reload recovers it from the signed-in user below.
  }
}

export function clearStudySession() {
  activeSession = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * The active study session, or null for regular users.
 * Synchronous: safe to call from write paths that need to tag rows.
 */
export function getActiveStudySession(): StudySession | null {
  if (activeSession) return activeSession;
  activeSession = readStored();
  return activeSession;
}

export function isStudySession(): boolean {
  return getActiveStudySession() !== null;
}

/**
 * Recover the study session from the signed-in user.
 *
 * sessionStorage is per-tab, so a participant who closes the tab and returns
 * to greenbot.live still holds a Supabase session but has lost the cached
 * pid. The participant's identity is recoverable from their user record, so
 * this keeps the ID on screen and keeps writes tagged.
 */
export async function recoverStudySessionFromUser(): Promise<StudySession | null> {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (!user?.email?.endsWith(`@${PARTICIPANT_EMAIL_DOMAIN}`)) return null;

    const pid = user.email.split("@")[0];
    if (!isValidPid(pid)) return null;

    const scenario = toScenario(user.user_metadata?.study_scenario);
    if (scenario === null) return null;

    const session: StudySession = { pid, scenario };
    writeStored(session);
    return session;
  } catch {
    return null;
  }
}

/**
 * The study session for whoever is signed in RIGHT NOW.
 *
 * The signed-in user is the source of truth, never the cache. sessionStorage
 * survives a sign-out and a sign-in as somebody else, so trusting it directly
 * meant an admin logging in on a tab that had been used for participant
 * testing was shown as that participant -- and, far worse, their messages
 * would have been tagged with that participant's pid.
 *
 * The cached value may only supply the scenario, and only when its pid agrees
 * with the signed-in account.
 */
export async function resolveStudySessionForCurrentUser(): Promise<StudySession | null> {
  try {
    const { data } = await supabase.auth.getUser();
    const email = data?.user?.email ?? "";

    if (!email.endsWith(`@${PARTICIPANT_EMAIL_DOMAIN}`)) {
      // An admin, a guest, or a regular user. Any cached study session belongs
      // to an earlier session in this tab and must not be applied to them.
      clearStudySession();
      return null;
    }

    const pid = email.split("@")[0];
    if (!isValidPid(pid)) {
      clearStudySession();
      return null;
    }

    const cached = readStored();
    const scenario =
      cached && cached.pid === pid
        ? cached.scenario
        : toScenario(data?.user?.user_metadata?.study_scenario);

    if (scenario === null) {
      clearStudySession();
      return null;
    }

    const session: StudySession = { pid, scenario };
    writeStored(session);
    return session;
  } catch {
    clearStudySession();
    return null;
  }
}

interface StudyAuthResponse {
  access_token?: string;
  refresh_token?: string;
  pid?: string;
  scenario?: number;
  returning?: boolean;
  error?: string;
  unknownPid?: boolean;
}

async function callStudyAuth(
  pid: string,
  scenario?: 1 | 2,
): Promise<StudySession> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const response = await fetch(`${supabaseUrl}/functions/v1/study-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(scenario ? { pid, scenario } : { pid }),
  });

  const payload: StudyAuthResponse = await response
    .json()
    .catch(() => ({}) as StudyAuthResponse);

  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(
      payload.error || "Could not start your study session. Please try again.",
    );
  }

  const resolvedScenario = toScenario(payload.scenario);
  if (resolvedScenario === null) {
    throw new Error("Study session returned an invalid scenario.");
  }

  const { error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  });

  if (error) throw error;

  const session: StudySession = { pid, scenario: resolvedScenario };
  writeStored(session);
  return session;
}

/**
 * Entry from the Qualtrics link. Returns null when the URL carries no valid
 * participant ID, which lets the caller fall through to the login screen.
 */
export async function startStudySessionFromUrl(): Promise<StudySession | null> {
  const { pid, scenario } = readStudyParamsFromUrl();
  if (!pid) return null;

  // A different pid in the URL than the one already signed in means a new
  // participant on a shared machine. Drop the old session first so their
  // conversation is never visible to the next student.
  const existing = getActiveStudySession();
  const { data } = await supabase.auth.getSession();

  if (data.session && (!existing || existing.pid !== pid)) {
    clearStudySession();
    await supabase.auth.signOut();
  } else if (
    existing?.pid === pid &&
    data.session &&
    (scenario === null || scenario === existing.scenario)
  ) {
    // Already signed in as this participant, in this scenario. A refresh or
    // back navigation lands here and needs no round trip.
    //
    // A DIFFERENT scenario for the same pid is the second half of the study,
    // so it must fall through: short-circuiting here would keep the old
    // scenario and file the new discussion under it.
    return existing;
  }

  return callStudyAuth(pid, scenario ?? undefined);
}

/**
 * Return visit: the participant types their ID on the login screen.
 * No scenario is sent, so study-auth will refuse to create a new participant
 * and instead returns the one recorded at first entry.
 */
export async function signInWithParticipantId(
  rawPid: string,
): Promise<StudySession> {
  const pid = rawPid.trim();
  if (!isValidPid(pid)) {
    throw new Error("Participant ID must be exactly 6 digits.");
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    clearStudySession();
    await supabase.auth.signOut();
  }

  return callStudyAuth(pid);
}

/**
 * The participant ID is the only way back into a conversation, so it is worth
 * telling students to save it -- once per pid, not on every visit.
 */
export function hasSeenSaveIdNotice(pid: string): boolean {
  try {
    return localStorage.getItem(`${NOTICE_KEY_PREFIX}${pid}`) === "true";
  } catch {
    return true;
  }
}

export function markSaveIdNoticeSeen(pid: string) {
  try {
    localStorage.setItem(`${NOTICE_KEY_PREFIX}${pid}`, "true");
  } catch {
    // ignore
  }
}
