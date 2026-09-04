-- ============================================================
-- RLS HARDENING
--
-- Study mode lets unauthenticated students obtain a session, so
-- anything reachable by "any signed-in user" is now reachable by
-- a study participant. Three existing holes are closed here.
-- ============================================================

-- ------------------------------------------------------------
-- 1. api_keys was world readable
-- ------------------------------------------------------------
-- 20240610000001_create_admin_tables.sql created:
--     CREATE POLICY "API keys are viewable by everyone"
--       ON public.api_keys FOR SELECT USING (true);
-- Policies are OR'd, so this overrode the owner-scoped policy added later
-- and let ANY session holder read every stored OpenAI/DeepSeek/Grok key.
--
-- AdminPanel only ever queries api_keys scoped to the current user
-- (.eq("user_id", <own id>)), and the ai-chat Edge Function reads only the
-- caller's own row, so the owner-scoped policy below covers all real usage.
DROP POLICY IF EXISTS "API keys are viewable by everyone" ON public.api_keys;

-- Re-assert the owner-scoped policy so a SELECT path always exists,
-- regardless of which of the two historical api_keys migrations applied.
DROP POLICY IF EXISTS "Users can only access their own API keys" ON public.api_keys;
CREATE POLICY "Users can only access their own API keys"
  ON public.api_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. New users could be auto-promoted to admin
-- ------------------------------------------------------------
-- handle_new_user() granted 'admin' to the first row in public.users. With
-- open registration that is a live trapdoor: if public.users were ever
-- emptied, the next person through the door -- possibly a study participant
-- -- becomes an administrator. Admin is now only ever granted manually.
--
-- The function also inserted NEW.email into a NOT NULL column, which breaks
-- for anonymous users. Email is made nullable and the insert is now
-- conflict-tolerant so a failure here can never block sign-up.
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'user')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- NOTE: existing admins are unaffected -- this only changes the role given
-- to newly created users. To grant admin:
--   UPDATE public.users SET role = 'admin' WHERE email = 'you@example.com';

-- ------------------------------------------------------------
-- 3. Study participants must never read another participant
-- ------------------------------------------------------------
-- No policy changes are needed on conversations or messages: both are
-- already scoped to auth.uid(), and study mode gives each pid its own
-- auth user rather than sharing one. This block documents that the
-- expected policies are present, and fails loudly if they are not.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
      AND policyname = 'Users can view their own conversations'
  ) THEN
    RAISE EXCEPTION
      'Expected owner-scoped SELECT policy on conversations is missing. '
      'Study mode must not be deployed without it.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND policyname = 'Users can view messages in their conversations'
  ) THEN
    RAISE EXCEPTION
      'Expected owner-scoped SELECT policy on messages is missing. '
      'Study mode must not be deployed without it.';
  END IF;
END $$;
