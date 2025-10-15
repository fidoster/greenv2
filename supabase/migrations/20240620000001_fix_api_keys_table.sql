-- Fix the api_keys table structure
ALTER TABLE api_keys
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing records to use created_by as user_id if needed
UPDATE api_keys
SET user_id = created_by
WHERE user_id IS NULL AND created_by IS NOT NULL;
