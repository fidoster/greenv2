-- Add user_email column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add user_email column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_email ON conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_messages_user_email ON messages(user_email);
