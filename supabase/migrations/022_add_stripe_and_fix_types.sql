-- Migration: Add Stripe fields and fix user_type/role constraints
-- Description: 
--   1. Elimina trigger de Make.com (ya no se usa)
--   2. Actualiza CHECK constraint de user_type: free | premium | vip
--   3. Añade campos de Stripe a profiles
--   4. Crea tabla subscription_events para logging de webhooks

-- ============================================================
-- 1. ELIMINAR trigger de Make.com
-- ============================================================
DROP TRIGGER IF EXISTS "Inicio Método" ON profiles;

-- ============================================================
-- 2. ACTUALIZAR CHECK constraint de user_type
--    Antes: 'free' | 'subscriber'
--    Ahora: 'free' | 'premium' | 'vip'
-- ============================================================
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_user_type_check;

ALTER TABLE profiles 
  ADD CONSTRAINT profiles_user_type_check 
  CHECK (user_type = ANY (ARRAY['free'::text, 'premium'::text, 'vip'::text]));

-- Actualizar cualquier usuario con user_type='subscriber' a 'premium' (si los hubiera)
UPDATE profiles SET user_type = 'premium' WHERE user_type = 'subscriber';

-- ============================================================
-- 3. AÑADIR campos de Stripe a profiles
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' 
    CHECK (subscription_status IN ('active', 'inactive', 'past_due', 'canceled', 'trialing')),
  ADD COLUMN IF NOT EXISTS payment_mode TEXT 
    CHECK (payment_mode IN ('monthly', 'full')),
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ;

-- Índice para búsquedas por stripe_customer_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id 
  ON profiles(stripe_customer_id) 
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- 4. CREAR tabla subscription_events (logging de webhooks Stripe)
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para subscription_events
CREATE INDEX IF NOT EXISTS idx_subscription_events_user_id 
  ON subscription_events(user_id);

CREATE INDEX IF NOT EXISTS idx_subscription_events_type 
  ON subscription_events(event_type);

-- RLS para subscription_events (solo service_role puede escribir)
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_subscription_events" 
  ON subscription_events 
  FOR ALL 
  TO service_role 
  USING (true);

COMMENT ON TABLE subscription_events IS 'Logging de eventos de Stripe webhook';
COMMENT ON COLUMN subscription_events.stripe_event_id IS 'ID único del evento en Stripe (para idempotencia)';
COMMENT ON COLUMN subscription_events.event_type IS 'Tipo de evento: checkout.session.completed, customer.subscription.updated, etc.';
