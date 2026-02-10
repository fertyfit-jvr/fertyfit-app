-- Migration: Add RLS policies for profiles table
-- Created: 2026-02-10
-- Description: Adds missing INSERT and SELECT policies for profiles table to allow user registration

-- Enable RLS on profiles table if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
    -- Drop SELECT policy if exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can view their own profile'
    ) THEN
        DROP POLICY "Users can view their own profile" ON profiles;
    END IF;

    -- Drop INSERT policy if exists
    IF EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can insert their own profile'
    ) THEN
        DROP POLICY "Users can insert their own profile" ON profiles;
    END IF;
END$$;

-- Create SELECT policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Create INSERT policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
ON profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON TABLE profiles TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE profiles IS 'User profiles with RLS enabled. Users can only view, insert, and update their own profile.';
