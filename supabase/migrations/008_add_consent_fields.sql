-- Migration to add explicit consent fields to profiles table
-- Created at: 2026-02-03

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS consent_personal_data BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_food BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_flora BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_flow BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_function BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_daily_log BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_no_diagnosis BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consents_at TIMESTAMPTZ;

-- Update existing profiles to have FALSE defaults (already handled by DEFAULT FALSE above, but good to be explicit for logic)
-- We don't want to auto-consent existing users, they should go through the flow too if we want to be strict.
-- However, for this task, the focus is "registra el usuario desde cero" (register user from scratch). 
-- Existing users might need a migration strategy, but we will stick to the default FALSE for safety.
