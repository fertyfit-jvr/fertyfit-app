-- Migration: Add missing F0 form fields to profiles table
-- Created: 2026-02-09
-- Description: Adds columns for fertility_treatments, diagnoses, and surgical_history from F0 form

-- Add fertility_treatments column (q20_fertility_treatments from F0)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS fertility_treatments TEXT;

-- Add diagnoses column (q9_diagnoses from F0) - using TEXT for now, can be JSONB array later
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS diagnoses TEXT;

-- Add surgical_history column (future F0 field)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS surgical_history TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.fertility_treatments IS 'Tratamientos de fertilidad previos del formulario F0 (q20_fertility_treatments)';
COMMENT ON COLUMN profiles.diagnoses IS 'Diagnósticos y breve historia médica del formulario F0 (q9_diagnoses)';
COMMENT ON COLUMN profiles.surgical_history IS 'Historia quirúrgica del usuario';
