-- ============================================================
-- RECORD WHAT KIND OF AUTH ATTEMPT WAS MADE
--
-- The rate limiter previously counted every failure from an IP and
-- checked that count BEFORE looking the participant up, so once an
-- IP hit the cap it blocked everyone -- including a valid returning
-- participant and a brand-new one arriving from Qualtrics.
--
-- On a shared campus IP that is a cohort-wide outage: ten mistyped
-- IDs anywhere in a lecture hall locks the whole room out for 15
-- minutes.
--
-- Throttling now applies only to requests for a pid that does NOT
-- already exist, which is what a brute-force walk generates. To
-- count those separately the log has to say which kind each attempt
-- was.
-- ============================================================

ALTER TABLE public.study_auth_attempts
  ADD COLUMN IF NOT EXISTS attempt_kind TEXT;

-- Counting is always "this ip, these kinds, since this time".
CREATE INDEX IF NOT EXISTS idx_study_auth_attempts_kind_time
  ON public.study_auth_attempts(ip_hash, attempt_kind, attempted_at DESC);

COMMENT ON COLUMN public.study_auth_attempts.attempt_kind IS
  'returning = pid existed and was signed in (never throttled); '
  'created = pid did not exist and was created from a Qualtrics link; '
  'unknown = pid did not exist and no scenario was supplied (a typo or a '
  'guess). Only created and unknown count toward the rate limit.';

-- Rows written before this column existed carry NULL and are ignored by the
-- limiter, which is correct: they predate the distinction.
