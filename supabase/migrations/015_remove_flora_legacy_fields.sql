-- Migration: Remove legacy/unused fields from pillar_flora table
-- Created: 2026-02-09
-- Description: Removes fields that are not being used in the current Flora form

-- Remove legacy fields that are not in current form
ALTER TABLE pillar_flora 
DROP COLUMN IF EXISTS vaginal_infections,
DROP COLUMN IF EXISTS altered_vaginal_ph,
DROP COLUMN IF EXISTS previous_probiotics,
DROP COLUMN IF EXISTS antibiotics_last_12_months,
DROP COLUMN IF EXISTS birth_lactation,
DROP COLUMN IF EXISTS bristol_stool_scale,
DROP COLUMN IF EXISTS microbiome_tests,
DROP COLUMN IF EXISTS recommended_supplements;

-- Add comments for documentation
COMMENT ON TABLE pillar_flora IS 'Flora pillar data - cleaned up to match current form definition';
