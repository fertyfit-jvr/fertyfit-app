-- Add new FLOW pillar fields: social_environment, healthy_relationships
-- Also fix stress_level constraint: DB had 1-10, ensure consistency

-- Add new columns to pillar_flow
ALTER TABLE public.pillar_flow
  ADD COLUMN IF NOT EXISTS social_environment TEXT,
  ADD COLUMN IF NOT EXISTS healthy_relationships BOOLEAN;

-- Update stress_level constraint if it was 0-10 (ensure 1-10)
-- The original migration has: stress_level INTEGER CHECK (stress_level BETWEEN 1 AND 10)
-- No change needed if already correct. This migration just adds the new columns.

-- Comment for documentation
COMMENT ON COLUMN public.pillar_flow.social_environment IS 'Entorno social: Relación familiar estable, Soledad, Otra (formato: opciones separadas por coma, :: para "otro" detalle)';
COMMENT ON COLUMN public.pillar_flow.healthy_relationships IS '¿Tienes relaciones saludables? Sí=true, No=false';
