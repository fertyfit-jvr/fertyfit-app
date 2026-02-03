-- Create a specific policy to allow users to update their own consent fields
-- First, drop the policy if it exists to avoid conflicts, or handle gracefully
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile"
        ON profiles
        FOR UPDATE
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);
    END IF;
END
$$;

-- Grant permissions to authenticated users just in case
GRANT UPDATE ON TABLE profiles TO authenticated;
