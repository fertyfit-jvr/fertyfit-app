-- Migration: Add drug use field to pillar_flow
-- Created: 2026-02-09
-- Description: Adds drug_use_last_year column to pillar_flow table

-- Add new field: drug use in last year
ALTER TABLE public.pillar_flow
  ADD COLUMN IF NOT EXISTS drug_use_last_year TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.pillar_flow.drug_use_last_year IS 'Consumo de drogas en el último año: "No" o "Sí: [detalles]"';
