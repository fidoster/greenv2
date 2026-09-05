-- ============================================================
-- RESEARCH CONSENT FLAG
--
-- The MARK2060 activity is compulsory; taking part in the study
-- is not. Students who decline still complete both dilemmas and
-- both GreenBot discussions, so their rows look identical to a
-- participant's. consent = 0 is what separates coursework from
-- research data.
--
-- Every design choice here fails closed. The column is NOT NULL
-- DEFAULT 0, so a row written by code that predates this change,
-- or by a path that forgets to set it, records 0 rather than
-- inheriting a 1. Getting this wrong in the safe direction costs
-- one student's data; getting it wrong in the unsafe direction
-- means analysing data from someone who declined.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Consent on the chat tables
-- ------------------------------------------------------------
-- Denormalised onto messages as well as conversations for the same
-- reason pid and scenario are: the export must be filterable on a
-- single column with no join. SMALLINT rather than BOOLEAN to match
-- the neighbouring scenario column and to store 1/0 as written.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS consent SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS consent SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_consent_values') THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_consent_values CHECK (consent IN (0, 1));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_consent_values') THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_consent_values CHECK (consent IN (0, 1));
  END IF;
END $$;

-- Composite rather than a bare consent index: the column has two
-- distinct values, so on its own it would rarely beat a sequential
-- scan. Every real query is "consented rows, by participant".
CREATE INDEX IF NOT EXISTS idx_messages_consent_pid
  ON public.messages(consent, pid);
CREATE INDEX IF NOT EXISTS idx_conversations_consent_pid
  ON public.conversations(consent, pid);

COMMENT ON COLUMN public.messages.consent IS
  '1 = the student agreed their data may be used as research data. '
  '0 = they declined, or no explicit consent reached this row. '
  'Rows with 0 are coursework only and must be excluded from analysis.';
COMMENT ON COLUMN public.conversations.consent IS
  'See messages.consent. Denormalised so a transcript can be filtered '
  'without a join.';

-- ------------------------------------------------------------
-- 2. Consent on the participant registry
-- ------------------------------------------------------------
-- sessionStorage does not survive closing the tab, so a student who
-- returns to greenbot.live without the questionnaire link has no
-- cached consent value. Without a server-side record the restored
-- session would fail closed to 0 and silently drop the second half
-- of a consenting student's data. The registry already persists
-- scenario across that same gap; consent is persisted the same way.
ALTER TABLE public.study_participants
  ADD COLUMN IF NOT EXISTS consent SMALLINT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'study_participants_consent_values') THEN
    ALTER TABLE public.study_participants
      ADD CONSTRAINT study_participants_consent_values CHECK (consent IN (0, 1));
  END IF;
END $$;

COMMENT ON COLUMN public.study_participants.consent IS
  'The last explicitly recorded consent for this session code. Only ever '
  'set from an explicit consent parameter on the questionnaire link; a '
  'manual ID login leaves it unchanged.';

-- ------------------------------------------------------------
-- 3. Surface consent to the admin dashboard
-- ------------------------------------------------------------
-- Appended to the end of the select list: CREATE OR REPLACE VIEW can
-- add trailing columns but cannot reorder or retype existing ones.
-- Still owner-executed with the admin check in the WHERE clause, and
-- auth_secret still absent, so access is unchanged.
CREATE OR REPLACE VIEW public.study_participants_admin AS
  SELECT pid, scenario, user_id, created_at, last_seen_at, consent
  FROM public.study_participants
  WHERE public.is_admin(auth.uid());

REVOKE ALL ON public.study_participants_admin FROM anon;
GRANT SELECT ON public.study_participants_admin TO authenticated;

-- ------------------------------------------------------------
-- 4. RLS is untouched
-- ------------------------------------------------------------
-- No policy on conversations or messages references a column list --
-- they filter on user_id, and the admin policies on is_admin() plus
-- pid. Adding a column changes none of that, and the tables carry
-- table-level grants rather than column-level ones, so the new
-- column inherits the existing privileges exactly.
