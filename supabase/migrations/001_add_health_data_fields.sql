-- Migration: Add Health Data Fields for Wearable Integration
-- Created: 2024
-- Description: Adds support for wearable health data integration

-- Add optional columns to daily_logs for health data
ALTER TABLE daily_logs 
ADD COLUMN IF NOT EXISTS health_data JSONB,
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'manual' CHECK (data_source IN ('manual', 'wearable', 'hybrid')),
ADD COLUMN IF NOT EXISTS hrv INTEGER,
ADD COLUMN IF NOT EXISTS resting_heart_rate INTEGER,
ADD COLUMN IF NOT EXISTS sleep_deep_minutes INTEGER,
ADD COLUMN IF NOT EXISTS sleep_rem_minutes INTEGER,
ADD COLUMN IF NOT EXISTS sleep_light_minutes INTEGER,
ADD COLUMN IF NOT EXISTS steps INTEGER,
ADD COLUMN IF NOT EXISTS active_calories INTEGER,
ADD COLUMN IF NOT EXISTS oxygen_saturation NUMERIC(5,2);

-- Add comments for documentation
COMMENT ON COLUMN daily_logs.health_data IS 'Full health data object from wearable (JSONB)';
COMMENT ON COLUMN daily_logs.data_source IS 'Origin of data: manual, wearable, or hybrid';
COMMENT ON COLUMN daily_logs.hrv IS 'Heart Rate Variability in milliseconds (stress indicator)';
COMMENT ON COLUMN daily_logs.resting_heart_rate IS 'Resting heart rate in bpm';
COMMENT ON COLUMN daily_logs.sleep_deep_minutes IS 'Deep sleep duration in minutes';
COMMENT ON COLUMN daily_logs.sleep_rem_minutes IS 'REM sleep duration in minutes';
COMMENT ON COLUMN daily_logs.sleep_light_minutes IS 'Light sleep duration in minutes';
COMMENT ON COLUMN daily_logs.steps IS 'Total steps for the day';
COMMENT ON COLUMN daily_logs.active_calories IS 'Active calories burned';
COMMENT ON COLUMN daily_logs.oxygen_saturation IS 'Blood oxygen saturation percentage';

-- Index for searching by data source
CREATE INDEX IF NOT EXISTS idx_daily_logs_data_source 
ON daily_logs(data_source) 
WHERE data_source != 'manual';

-- Index for health data queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_daily_logs_health_data 
ON daily_logs USING GIN (health_data) 
WHERE health_data IS NOT NULL;

-- Table for wearable connection status
CREATE TABLE IF NOT EXISTS wearable_connections (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  is_connected BOOLEAN DEFAULT false,
  device_type TEXT,
  device_id TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  permissions_granted BOOLEAN DEFAULT false,
  connection_state TEXT DEFAULT 'disconnected' CHECK (connection_state IN (
    'unavailable', 'disconnected', 'connecting', 'connected', 
    'syncing', 'error_permissions', 'error_sync'
  )),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for wearable connections
CREATE INDEX IF NOT EXISTS idx_wearable_connections_user 
ON wearable_connections(user_id);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_state 
ON wearable_connections(connection_state) 
WHERE is_connected = true;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_wearable_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_wearable_connections_timestamp
BEFORE UPDATE ON wearable_connections
FOR EACH ROW
EXECUTE FUNCTION update_wearable_connections_updated_at();

-- Add comments
COMMENT ON TABLE wearable_connections IS 'Tracks wearable device connections and sync status per user';
COMMENT ON COLUMN wearable_connections.device_type IS 'Type of wearable: Apple Watch, Oura Ring, Fitbit, etc.';
COMMENT ON COLUMN wearable_connections.connection_state IS 'Current state of connection';
COMMENT ON COLUMN wearable_connections.last_sync_at IS 'Timestamp of last successful sync';

