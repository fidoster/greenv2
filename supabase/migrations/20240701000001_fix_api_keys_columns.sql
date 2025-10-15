-- Add missing columns to api_keys table
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS deepseek_key TEXT,
ADD COLUMN IF NOT EXISTS openai_key TEXT,
ADD COLUMN IF NOT EXISTS grok_key TEXT;

-- Enable realtime for the table
alter publication supabase_realtime add table api_keys;
