-- Migration: Add Period History for Auto-Cycle Calculation
-- Created: 2024
-- Description: Adds period_history column to profiles table for automatic cycle length calculation

-- Add period_history column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS period_history JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.period_history IS 'Array of period dates (YYYY-MM-DD) for automatic cycle length calculation. Stores last 12 periods maximum.';

-- Create index for efficient queries on period_history
CREATE INDEX IF NOT EXISTS idx_profiles_period_history 
ON profiles USING GIN (period_history) 
WHERE period_history IS NOT NULL AND jsonb_array_length(period_history) > 0;

