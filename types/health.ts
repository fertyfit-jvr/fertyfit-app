/**
 * Health Data Types for Wearable Integration
 * Supports Apple HealthKit, Google Health Connect, and manual entry
 */

/**
 * Source of health data
 */
export type HealthDataSource = 'Apple HealthKit' | 'Google Health Connect' | 'Manual' | 'Hybrid';

/**
 * Device type that provided the data
 */
export type WearableDeviceType = 
  | 'Apple Watch'
  | 'Oura Ring'
  | 'Fitbit'
  | 'Garmin'
  | 'Whoop'
  | 'Samsung Health'
  | 'Xiaomi Mi Band'
  | 'Polar'
  | 'Withings'
  | 'Unknown';

/**
 * Sleep quality calculated from sleep phases
 */
export type SleepQuality = 1 | 2 | 3 | 4 | 5;

/**
 * Health data structure from wearables
 */
export interface HealthData {
  // Temperature (FLOW pillar)
  basalBodyTemperature?: number; // Celsius
  
  // Sleep (FLOW pillar)
  sleepDurationMinutes?: number;
  sleepDeepMinutes?: number;
  sleepRemMinutes?: number;
  sleepLightMinutes?: number;
  sleepQuality?: SleepQuality; // Calculated from phases
  
  // Activity (FOOD pillar)
  steps?: number;
  activeCalories?: number; // kcal
  activityMinutes?: number;
  distanceMeters?: number;
  
  // Cardiovascular (FUNCTION pillar)
  restingHeartRate?: number; // bpm
  heartRateVariability?: number; // HRV in ms - stress indicator
  maxHeartRate?: number; // bpm
  avgHeartRate?: number; // bpm
  
  // Respiration (FUNCTION pillar)
  oxygenSaturation?: number; // SpO2 percentage
  respiratoryRate?: number; // breaths per minute
  
  // Weight (FUNCTION pillar)
  weight?: number; // kg
  
  // Stress indicators (FLOW pillar)
  stressLevel?: number; // 1-5 (calculated from HRV)
  
  // Metadata
  source?: HealthDataSource;
  syncedAt?: string; // ISO timestamp
  deviceName?: WearableDeviceType;
  deviceId?: string; // Unique device identifier
}

/**
 * Sleep phases breakdown
 */
export interface SleepPhases {
  deep: number; // minutes
  rem: number; // minutes
  light: number; // minutes
  awake: number; // minutes (optional)
}

/**
 * Wearable connection status
 */
export interface WearableConnectionStatus {
  isConnected: boolean;
  lastSync: Date | null;
  deviceType?: WearableDeviceType;
  deviceName?: string;
  permissionsGranted: boolean;
  platform?: 'ios' | 'android' | 'web';
  error?: string;
  errorCode?: 'PERMISSIONS_REVOKED' | 'SYNC_TIMEOUT' | 'NO_DATA_AVAILABLE' | 'DEVICE_NOT_FOUND' | 'NETWORK_ERROR';
}

/**
 * Connection state for UI
 */
export type ConnectionState = 
  | 'unavailable'      // Device not compatible
  | 'disconnected'     // Available but not connected
  | 'connecting'       // Requesting permissions
  | 'connected'        // Connected and working
  | 'syncing'          // Syncing data
  | 'error_permissions'// Permissions denied
  | 'error_sync';      // Sync error

/**
 * Sync result from sync manager
 */
export interface SyncResult {
  success: boolean;
  data: HealthData | null;
  errors: Array<{ type: string; message: string }>;
  mode: 'wearable' | 'manual' | 'hybrid' | 'none';
  timestamp: Date;
}

/**
 * Health data validation result
 */
export interface HealthDataValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Health data ranges for validation
 */
export const HEALTH_DATA_RANGES = {
  bbt: { min: 35.5, max: 38.0 }, // Celsius
  hrv: { min: 20, max: 200 }, // milliseconds
  sleepDuration: { min: 120, max: 840 }, // 2h - 14h in minutes
  restingHeartRate: { min: 40, max: 120 }, // bpm
  oxygenSaturation: { min: 90, max: 100 }, // percentage
  respiratoryRate: { min: 10, max: 30 }, // breaths per minute
  steps: { min: 0, max: 50000 }, // daily steps
  activityMinutes: { min: 0, max: 1440 }, // max 24h
} as const;
