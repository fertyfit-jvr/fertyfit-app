-- Migration: Remove obsolete disclaimer_accepted column
-- Created: 2026-02-10
-- Description: Removes the deprecated disclaimer_accepted field, now replaced by individual consent fields

-- Remove the disclaimer_accepted column from profiles table
ALTER TABLE profiles 
DROP COLUMN IF EXISTS disclaimer_accepted;

-- Add comment for documentation
COMMENT ON TABLE profiles IS 'User profiles with RLS enabled. Uses individual consent fields instead of deprecated disclaimer_accepted.';
