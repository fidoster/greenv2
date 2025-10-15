# Email Tracking Update - GreenBot v2

## Overview
This update adds user email tracking to both `conversations` and `messages` tables in Supabase. This allows you to identify which user sent each message and created each conversation.

## Changes Made

### 1. Database Schema Changes
Added `user_email` column to both tables:
- **conversations** table: `user_email TEXT`
- **messages** table: `user_email TEXT`

### 2. Code Changes

**Files Modified:**
- `src/lib/chat-service.ts` - Updated `createConversation()` and `saveMessage()` functions
- `src/types/supabase.ts` - Updated TypeScript types to reflect new schema

**Key Changes:**
- `createConversation()` now retrieves and stores the user's email from `supabase.auth.getUser()`
- `saveMessage()` now retrieves and stores the user's email for each message
- Both functions log the email in console for debugging

### 3. Migration File Created
- `supabase/migrations/add_user_email_columns.sql`

## Deployment Steps

### Step 1: Run the SQL Migration

You have two options:

**Option A: Using Supabase CLI (Recommended)**
```bash
npx supabase db push
```

**Option B: Using Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run the following SQL:

```sql
-- Add user_email column to conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Add user_email column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS user_email TEXT;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_email ON conversations(user_email);
CREATE INDEX IF NOT EXISTS idx_messages_user_email ON messages(user_email);
```

4. Click **Run** to execute the migration

### Step 2: Verify Database Changes

In Supabase Dashboard → Table Editor:
1. Check **conversations** table - should have `user_email` column
2. Check **messages** table - should have `user_email` column

### Step 3: Push Code to GitHub

```bash
git add .
git commit -m "Add user email tracking to conversations and messages

- Added user_email column to conversations and messages tables
- Updated createConversation() to store user email
- Updated saveMessage() to store user email
- Updated TypeScript types for new schema
- Added database migration for email columns
- Added indexes for better query performance"

git push origin main
```

### Step 4: Verify Deployment on Vercel

1. Vercel will automatically deploy the changes
2. Wait for deployment to complete (check Vercel dashboard)
3. Visit your deployed app

### Step 5: Test the Changes

1. **Log in** to your app
2. **Open browser console** (F12 → Console tab)
3. **Start a new conversation**
   - You should see: `Creating conversation with title: ..., userEmail: your@email.com`
4. **Send a message**
   - You should see: `Saving message to conversation ... from user your@email.com`
5. **Check Supabase Dashboard**
   - Go to Table Editor → `conversations`
   - Find your conversation - `user_email` should be populated
   - Go to Table Editor → `messages`
   - Find your messages - `user_email` should be populated

## What This Enables

### 1. User Activity Tracking
You can now query messages and conversations by user email:

```sql
-- Get all conversations by a specific user
SELECT * FROM conversations
WHERE user_email = 'user@example.com';

-- Get all messages by a specific user
SELECT * FROM messages
WHERE user_email = 'user@example.com';
```

### 2. Analytics & Reporting
You can analyze usage patterns:

```sql
-- Count conversations per user
SELECT user_email, COUNT(*) as conversation_count
FROM conversations
GROUP BY user_email
ORDER BY conversation_count DESC;

-- Count messages per user
SELECT user_email, COUNT(*) as message_count
FROM messages
GROUP BY user_email
ORDER BY message_count DESC;
```

### 3. User Support
When a user reports an issue, you can easily find their conversations and messages by email.

### 4. Data Export
You can export user data including their email for GDPR/data requests:

```sql
-- Export all data for a specific user
SELECT
  c.id as conversation_id,
  c.title,
  c.persona,
  c.created_at,
  c.user_email,
  m.content as message_content,
  m.sender,
  m.created_at as message_time
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.user_email = 'user@example.com'
ORDER BY c.created_at, m.created_at;
```

## Important Notes

### Backward Compatibility
- **Existing records**: Old conversations and messages will have `user_email` as `NULL`
- **New records**: Will automatically include the user's email
- No data loss or breaking changes

### Privacy Considerations
- User emails are stored alongside their messages
- Make sure your privacy policy covers this data collection
- Consider adding email encryption if handling sensitive data
- RLS policies still apply - users can only access their own data

### Performance
- Indexes were added on `user_email` columns for fast queries
- No performance impact on existing queries
- Email lookup queries will be fast

## Troubleshooting

### Error: "column user_email does not exist"
**Solution**: Run the SQL migration in Supabase Dashboard

### Email is NULL in database
**Solution**:
1. Check browser console for errors
2. Verify user is authenticated: `supabase.auth.getUser()` should return user data
3. Check that the code changes were deployed correctly

### TypeScript errors
**Solution**:
1. Make sure `src/types/supabase.ts` includes the `user_email` field
2. Restart your TypeScript server / development server
3. Run `npm run build` to check for type errors

## Future Enhancements

You could extend this further by:
1. Adding user name alongside email
2. Tracking IP addresses for security
3. Adding user agent information
4. Creating a user activity dashboard
5. Implementing email notifications based on this data

---

**Deployed**: 2025-10-15
**Status**: ✅ Ready for production
