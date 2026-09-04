-- ============================================================
-- ADMIN ACCESS TO STUDY DATA
--
-- The study dashboard needs to read conversations and messages
-- across all participants. Existing policies scope both tables to
-- auth.uid() = user_id, so an admin currently sees only their own
-- chats and the dashboard would render empty.
--
-- These policies are ADDITIVE. Policies are OR'd, so participant
-- isolation is unchanged: a study participant still matches only
-- the owner clause and still cannot see anyone else's rows.
-- is_admin() is SECURITY DEFINER (see 20260904000002) so it reads
-- public.users without recursing through that table's own policy.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Admins can read all conversations and messages
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all conversations" ON public.conversations;
CREATE POLICY "Admins can view all conversations"
  ON public.conversations FOR SELECT
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages"
  ON public.messages FOR SELECT
  USING (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 2. Admins can delete STUDY data only
-- ------------------------------------------------------------
-- The dashboard's bulk delete is deliberately restricted to study rows.
-- Enforcing "pid IS NOT NULL" in the policy rather than only in the client
-- means a bug, a mistyped filter, or a hand-written query from the browser
-- cannot destroy a regular user's conversation: the database refuses.
DROP POLICY IF EXISTS "Admins can delete study conversations" ON public.conversations;
CREATE POLICY "Admins can delete study conversations"
  ON public.conversations FOR DELETE
  USING (public.is_admin(auth.uid()) AND pid IS NOT NULL);

DROP POLICY IF EXISTS "Admins can delete study messages" ON public.messages;
CREATE POLICY "Admins can delete study messages"
  ON public.messages FOR DELETE
  USING (public.is_admin(auth.uid()) AND pid IS NOT NULL);

-- ------------------------------------------------------------
-- 3. Admins can read the participant registry, minus the secret
-- ------------------------------------------------------------
-- The dashboard needs pid, scenario and timestamps so it can show
-- participants who signed in but never sent a message.
--
-- study_participants stays service-role only and gets NO select policy.
-- Granting one would expose auth_secret -- the credential that mints a
-- participant session -- to anyone who queried the table directly, which a
-- view alone would not prevent.
--
-- Instead this view runs with its owner's rights (the default: no
-- security_invoker), so it bypasses the base table's RLS, and the admin
-- check lives in the WHERE clause. auth_secret is not in the select list,
-- so there is no route to it for any non-service role.
CREATE OR REPLACE VIEW public.study_participants_admin AS
  SELECT pid, scenario, user_id, created_at, last_seen_at
  FROM public.study_participants
  WHERE public.is_admin(auth.uid());

REVOKE ALL ON public.study_participants_admin FROM anon;
GRANT SELECT ON public.study_participants_admin TO authenticated;
