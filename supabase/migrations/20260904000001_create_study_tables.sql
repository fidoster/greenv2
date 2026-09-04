-- ============================================================
-- STUDY MODE: participant identity and data tagging
--
-- Supports the University of Vaasa study flow, where students
-- arrive from Qualtrics via /?pid=482913&scenario=1 and may
-- later return to greenbot.live and sign in with the same pid.
--
-- Design notes:
--   * A pid maps to exactly one auth.users row, so all existing
--     RLS ("auth.uid() = user_id") keeps working unchanged and
--     participants remain isolated from each other by Postgres.
--   * study_participants and study_auth_attempts carry NO policies
--     while RLS is enabled, which denies every anon/authenticated
--     request. Only the service role (the study-auth Edge Function)
--     can touch them.
--   * pid is the only identifier stored. No names, emails or
--     student numbers.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Participant registry (service role only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.study_participants (
  pid           TEXT PRIMARY KEY CHECK (pid ~ '^[0-9]{6}$'),
  scenario      SMALLINT NOT NULL CHECK (scenario IN (1, 2)),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Random password generated server-side so the Edge Function can mint a
  -- session for this participant. Never leaves the function.
  auth_secret   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_participants_user_id
  ON public.study_participants(user_id);

ALTER TABLE public.study_participants ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies: RLS with zero policies denies all access to the
-- anon and authenticated roles. The service role bypasses RLS.
-- Revoke the default grants as belt and braces.
REVOKE ALL ON public.study_participants FROM anon, authenticated;

-- ------------------------------------------------------------
-- 2. Login attempt log, for rate limiting (service role only)
-- ------------------------------------------------------------
-- A 6-digit pid is a weak credential, so participant-ID logins are rate
-- limited per client. We store a salted hash of the IP rather than the IP
-- itself: the raw address is personal data under GDPR and is not needed.
CREATE TABLE IF NOT EXISTS public.study_auth_attempts (
  id            BIGSERIAL PRIMARY KEY,
  ip_hash       TEXT NOT NULL,
  succeeded     BOOLEAN NOT NULL DEFAULT false,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_study_auth_attempts_ip_time
  ON public.study_auth_attempts(ip_hash, attempted_at DESC);

ALTER TABLE public.study_auth_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.study_auth_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.study_auth_attempts_id_seq FROM anon, authenticated;

-- ------------------------------------------------------------
-- 3. Tag chat data with pid + scenario
-- ------------------------------------------------------------
-- Denormalised onto messages as well as conversations: requirement is that
-- every message row carries the pid and scenario so the chat log can be
-- joined to the Qualtrics export without a second lookup.
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS pid TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS scenario SMALLINT;
ALTER TABLE public.messages      ADD COLUMN IF NOT EXISTS pid TEXT;
ALTER TABLE public.messages      ADD COLUMN IF NOT EXISTS scenario SMALLINT;

-- Constraints allow NULL so existing non-study rows stay valid.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_pid_format') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_pid_format
      CHECK (pid IS NULL OR pid ~ '^[0-9]{6}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_scenario_range') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_scenario_range
      CHECK (scenario IS NULL OR scenario IN (1, 2));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_pid_format') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_pid_format
      CHECK (pid IS NULL OR pid ~ '^[0-9]{6}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_scenario_range') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_scenario_range
      CHECK (scenario IS NULL OR scenario IN (1, 2));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_conversations_pid ON public.conversations(pid);
CREATE INDEX IF NOT EXISTS idx_messages_pid      ON public.messages(pid);
CREATE INDEX IF NOT EXISTS idx_messages_pid_created
  ON public.messages(pid, created_at);
