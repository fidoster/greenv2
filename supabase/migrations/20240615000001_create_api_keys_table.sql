-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  deepseek_key TEXT,
  openai_key TEXT,
  grok_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable row level security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Users can only access their own API keys" ON api_keys;
CREATE POLICY "Users can only access their own API keys"
  ON api_keys
  FOR ALL
  USING (auth.uid() = user_id);

-- Add to realtime publication
alter publication supabase_realtime add table api_keys;