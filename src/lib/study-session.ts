// Study mode session handling.
//
// A participant arrives either from Qualtrics
// (/?pid=482913&scenario=1&consent=1) or by typing their session code at
// greenbot.live. Both paths call the study-auth Edge Function, which returns
// a session for the one auth user that belongs to that pid. From then on the
// app is normally authenticated, so every existing RLS policy applies
// unchanged.

import { supabase } from "./supabase";

export interface StudySession {
  pid: string;
  scenario: 1 | 2;
  /**
   * 1 only when the student explicitly agreed their data may be used as
   * research data. Everything else -- a missing parameter, a malformed one,
   * a restored session with no recorded value -- is 0.
   */
  consent: 0 | 1;
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
 * Consent is the one value in this file that must never be inferred.
 *
 * Only the exact string "1" (or the number, for values coming back from the
 * server) means consent. Absent, empty, "true", "yes", " 1", "01" -- all of
 * it is 0. Number() is deliberately NOT used here: it maps "", null and
 * whitespace to 0 by accident rather than by decision, and " 1 " to 1, which
 * is exactly the kind of accident this function exists to prevent.
 */
function toConsent(value: unknown): 0 | 1 {
  if (value === 1 || value === "1") return 1;
  return 0;
}

/**
 * Read and validate study parameters from the current URL.
 * Anything that is not exactly 6 digits is ignored, so /?pid=abc and /?pid=12
 * fall through to the normal login screen.
 */
export function readStudyParamsFromUrl(): {
  pid: string | null;
  scenario: 1 | 2 | null;
  consent: 0 | 1;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const rawPid = params.get("pid");
    const pid = isValidPid(rawPid) ? rawPid : null;
    return {
      pid,
      scenario: toScenario(params.get("scenario")),
      consent: toConsent(params.get("consent")),
    };
  } catch {
    return { pid: null, scenario: null, consent: 0 };
  }
}

/** True when the URL carries a well-formed session code. */
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
    // A session stored before consent existed has no consent key and reads
    // back as 0, which is the correct answer for it.
    return { pid: parsed.pid, scenario, consent: toConsent(parsed?.consent) };
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

    const session: StudySession = {
      pid,
      scenario,
      consent: toConsent(user.user_metadata?.study_consent),
    };
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
 * The cached value may only supply the scenario and consent, and only when
 * its pid agrees with the signed-in account.
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
    const sameParticipant = cached !== null && cached.pid === pid;

    const scenario = sameParticipant
      ? cached.scenario
      : toScenario(data?.user?.user_metadata?.study_scenario);

    // Falls back to the value recorded on the auth user, which study-auth
    // writes from the registry at every sign-in. If neither knows, this is 0.
    const consent = sameParticipant
      ? cached.consent
      : toConsent(data?.user?.user_metadata?.study_consent);

    if (scenario === null) {
      clearStudySession();
      return null;
    }

    const session: StudySession = { pid, scenario, consent };
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
  consent?: number;
  returning?: boolean;
  error?: string;
  unknownPid?: boolean;
}

async function callStudyAuth(
  pid: string,
  scenario?: 1 | 2,
  // Sent only on the questionnaire-link path. Omitted entirely on a manual
  // ID login, which tells the Edge Function to keep the consent it already
  // recorded rather than overwriting it with a value nobody gave.
  consent?: 0 | 1,
): Promise<StudySession> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const requestBody: Record<string, unknown> = { pid };
  if (scenario) requestBody.scenario = scenario;
  if (consent !== undefined) requestBody.consent = consent;

  const response = await fetch(`${supabaseUrl}/functions/v1/study-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(requestBody),
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

  const session: StudySession = {
    pid,
    scenario: resolvedScenario,
    // The server's answer, not the request's: on a manual login it is the
    // recorded value, and a response that omits it resolves to 0.
    consent: toConsent(payload.consent),
  };
  writeStored(session);
  return session;
}

/**
 * Entry from the Qualtrics link. Returns null when the URL carries no valid
 * session code, which lets the caller fall through to the login screen.
 */
export async function startStudySessionFromUrl(): Promise<StudySession | null> {
  const { pid, scenario, consent } = readStudyParamsFromUrl();
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
    (scenario === null || scenario === existing.scenario) &&
    consent === existing.consent
  ) {
    // Already signed in as this participant, in this scenario, with this
    // consent. A refresh or back navigation lands here and needs no round
    // trip: the URL still carries the same parameters, so the session it
    // returns is the one it started with.
    //
    // A DIFFERENT scenario for the same pid is the second half of the study,
    // so it must fall through: short-circuiting here would keep the old
    // scenario and file the new discussion under it. A different consent
    // value falls through for the same reason -- the student's answer has
    // changed and the server has to record it.
    return existing;
  }

  return callStudyAuth(pid, scenario ?? undefined, consent);
}

/**
 * Return visit: the participant types their session code on the login screen.
 * No scenario is sent, so study-auth will refuse to create a new participant
 * and instead returns the one recorded at first entry. No consent is sent
 * either: the recorded answer stands, and a login form is not the place to
 * re-decide it.
 */
export async function signInWithParticipantId(
  rawPid: string,
): Promise<StudySession> {
  const pid = rawPid.trim();
  if (!isValidPid(pid)) {
    throw new Error("Session code must be exactly 6 digits.");
  }

  const { data } = await supabase.auth.getSession();
  if (data.session) {
    clearStudySession();
    await supabase.auth.signOut();
  }

  return callStudyAuth(pid);
}

/**
 * The session code is the only way back into a conversation, so it is worth
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
