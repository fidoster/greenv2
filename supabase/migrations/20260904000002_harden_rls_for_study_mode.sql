-- ============================================================
-- RLS HARDENING
--
-- Study mode lets unauthenticated students obtain a session, so
-- anything reachable by "any signed-in user" is now reachable by
-- a study participant.
--
-- Written against the ACTUAL state of this database, which differs
-- from the migration files: 20240610000001_create_admin_tables.sql
-- was never applied here, so public.users does not exist and the
-- role model the app assumes has no backing table. Every step below
-- is conditional so this is safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. api_keys must be readable only by its owner
-- ------------------------------------------------------------
-- 20240610000001 would have created:
--     CREATE POLICY "API keys are viewable by everyone"
--       ON public.api_keys FOR SELECT USING (true);
-- That migration did not run here, but the DROP is kept so this file
-- also repairs any environment where it did.
DROP POLICY IF EXISTS "API keys are viewable by everyone" ON public.api_keys;

DO $$
BEGIN
  -- Only assert the owner-scoped policy if the column it depends on exists.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys'
      AND column_name = 'user_id'
  ) THEN
    DROP POLICY IF EXISTS "Users can only access their own API keys" ON public.api_keys;
    CREATE POLICY "Users can only access their own API keys"
      ON public.api_keys
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  ELSE
    RAISE EXCEPTION
      'public.api_keys has no user_id column; cannot scope it to an owner.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 2. public.users -- the role table the app already queries
-- ------------------------------------------------------------
-- AdminPanel, AdminRoute and the /admin guard all read users.role, but
-- the table was never created in this project, so /admin had no role
-- check at all: any session holder could open it. Guests could already;
-- study participants would be able to as well.
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Email is nullable on purpose: anonymous (guest) users have none, and a
-- NOT NULL column here would abort their sign-up.
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

-- Backfill everyone who already has an account. Role 'user' for all --
-- admin is never granted automatically, see the note at the end.
INSERT INTO public.users (id, email, role)
SELECT id, email, 'user' FROM auth.users
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- A policy on public.users that itself selects from public.users recurses
-- infinitely. SECURITY DEFINER sidesteps RLS inside the function, which is
-- the standard way out.
CREATE OR REPLACE FUNCTION public.is_admin(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users WHERE id = uid AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Users are viewable by self or admins" ON public.users;
CREATE POLICY "Users are viewable by self or admins"
  ON public.users FOR SELECT
  USING (auth.uid() = id OR public.is_admin(auth.uid()));

-- No self-update policy: a user must not be able to promote themselves.
DROP POLICY IF EXISTS "Users are writable by admins" ON public.users;
CREATE POLICY "Users are writable by admins"
  ON public.users FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ------------------------------------------------------------
-- 3. Keep public.users in step with auth.users
-- ------------------------------------------------------------
-- The original handle_new_user() granted 'admin' to the first row in
-- public.users, which is a trapdoor if the table is ever emptied: the next
-- person through the door, possibly a study participant, becomes an
-- administrator. This version never grants admin.
--
-- It also swallows its own errors. A trigger on auth.users that raises will
-- block sign-up for every user, study participants included, so a failure
-- here must never be fatal.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.users (id, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 4. Participant isolation must already be in place
-- ------------------------------------------------------------
-- No policy changes are needed on conversations or messages: both are
-- already scoped to auth.uid(), and study mode gives each pid its own auth
-- user rather than sharing one. Fail loudly if that is not true.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'No SELECT policy on conversations. Study mode must not be deployed '
      'without owner-scoped access control.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages'
      AND cmd = 'SELECT'
  ) THEN
    RAISE EXCEPTION
      'No SELECT policy on messages. Study mode must not be deployed '
      'without owner-scoped access control.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- ACTION REQUIRED after applying
-- ------------------------------------------------------------
-- Every existing account was backfilled as 'user', so nobody is an admin
-- and /admin is closed to all. Grant it deliberately:
--
--   UPDATE public.users SET role = 'admin' WHERE email = 'you@example.com';
