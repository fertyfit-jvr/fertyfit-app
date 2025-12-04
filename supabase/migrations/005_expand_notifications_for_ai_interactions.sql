-- Migration: Expand notifications table for AI interactions
-- Created: 2025
-- Description: Expands notifications.type to include AI interaction types (REPORT, LABS, CHAT)
--              This allows storing all AI-generated content (reports, lab explanations, chat) in one unified table

-- Expand the type constraint to include AI interaction types
-- First, drop the existing constraint if it exists
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add new constraint with expanded types
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  -- System notification types (existing)
  'insight', 'alert', 'tip', 'celebration', 'opportunity', 'confirmation',
  -- AI interaction types (new)
  'REPORT', 'LABS', 'CHAT'
));

-- Add index for efficient queries by AI interaction type
CREATE INDEX IF NOT EXISTS idx_notifications_ai_type 
ON notifications(user_id, type, created_at DESC) 
WHERE type IN ('REPORT', 'LABS', 'CHAT');

-- Add comment for documentation
COMMENT ON COLUMN notifications.type IS 'Type of notification: system types (insight, alert, tip, etc.) or AI interaction types (REPORT, LABS, CHAT)';
COMMENT ON COLUMN notifications.metadata IS 'JSONB metadata. For AI interactions: contains input, sources, rag_context, etc. For system notifications: contains ruleId, actions, etc.';

