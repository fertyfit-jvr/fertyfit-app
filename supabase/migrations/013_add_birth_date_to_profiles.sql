-- Migration: Add birth_date column to profiles table
-- Created: 2026-02-09
-- Description: Stores user's birth date for accurate age calculation

-- Add birth_date column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Add comment for documentation
COMMENT ON COLUMN profiles.birth_date IS 'Fecha de nacimiento del usuario (YYYY-MM-DD). Se usa para calcular la edad actual.';

-- Create index for efficient queries on birth_date
CREATE INDEX IF NOT EXISTS idx_profiles_birth_date 
ON profiles(birth_date) 
WHERE birth_date IS NOT NULL;
