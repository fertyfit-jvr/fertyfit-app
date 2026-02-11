-- Migration: Ensure RLS policies for notifications table
-- Created: 2026-02-11
-- Description: Adds or replaces RLS policies for notifications to ensure users can read/update their own data.

-- 1. Enable RLS (idempotent)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure clean slate (or avoid errors if they exist with different names)
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;

-- 3. Create policies
-- Allow users to view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

-- Allow users to update their own notifications (e.g. mark as read, soft delete)
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Allow users to insert their own notifications (if needed for client-side notifs, though usually server-side)
-- Useful for testing or client-generated alerts
CREATE POLICY "Users can insert their own notifications"
ON notifications FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 4. Verify/Ensure indexes exist (from previous migrations, but good to double check for performance)
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
