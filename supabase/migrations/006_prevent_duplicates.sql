-- 1. CLEANUP: Delete existing duplicates to allow index creation
-- We keep the FIRST notification (oldest created_at) and delete the rest
DELETE FROM notifications
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, (metadata->>'ruleId'), (created_at::DATE)
            ORDER BY created_at ASC
        ) as rnum
        FROM notifications
        WHERE metadata->>'ruleId' IS NOT NULL
    ) t
    WHERE t.rnum > 1
);

-- 2. Create a unique index on user_id + ruleId (from metadata) + date(created_at)
-- This ensures that a specific rule (e.g. 'VF-1') can only trigger ONCE per day for a user.
-- We use COALESCE to handle potential nulls in metadata, though our rules always set it.

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unique_daily_rule 
ON notifications (user_id, ((metadata->>'ruleId')), (created_at::DATE))
WHERE metadata->>'ruleId' IS NOT NULL;  -- Only apply to notifications with a ruleId

-- Add comment for documentation
COMMENT ON INDEX idx_notifications_unique_daily_rule IS 'Ensures a rule can only trigger one notification per day for a user';
