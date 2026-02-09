-- Migration: Add coffee and alcohol questions to pillar_food
-- Created: 2026-02-09
-- Description: Adds coffee_cups and alcohol_consumption columns to pillar_food table

-- Add new fields
ALTER TABLE public.pillar_food
  ADD COLUMN IF NOT EXISTS coffee_cups INTEGER,
  ADD COLUMN IF NOT EXISTS alcohol_consumption TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.pillar_food.coffee_cups IS 'Tazas de café por día (0-10)';
COMMENT ON COLUMN public.pillar_food.alcohol_consumption IS 'Consumo de alcohol semanal (opciones a-d)';
