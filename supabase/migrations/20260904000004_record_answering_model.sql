-- ============================================================
-- RECORD WHICH MODEL ANSWERED
--
-- The ai-chat function now fails over from OpenAI to Grok when
-- OpenAI is rate limited or down. That keeps a study session
-- alive under load, but it means two different models can answer
-- within one cohort -- and without recording which, the dataset
-- silently mixes them and the difference is unrecoverable after
-- the fact.
--
-- Null is expected on user messages and on bot messages that
-- carry the canned "trouble connecting" text, so an API failure
-- is never mistaken for a model's answer.
-- ============================================================

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS model TEXT;

-- Rows written before this column existed came from gpt-4o or gpt-5.6-luna
-- and cannot be told apart now, so they are deliberately left NULL rather
-- than backfilled with a guess.

CREATE INDEX IF NOT EXISTS idx_messages_model ON public.messages(model);

COMMENT ON COLUMN public.messages.model IS
  'Model that generated a bot reply (e.g. gpt-5.6-luna, grok-4.1-fast). '
  'NULL for user messages and for locally generated error text.';
