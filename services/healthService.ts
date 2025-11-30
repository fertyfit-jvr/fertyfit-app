/**
 * Health Service for Wearable Integration
 * Handles data fetching from Apple HealthKit (iOS) and Google Health Connect (Android)
 */

import { HealthData, HealthDataSource, WearableDeviceType, HealthDataValidation, HEALTH_DATA_RANGES } from '../types/health';
import { logger } from '../lib/logger';

/**
 * Platform detection
 */
export type Platform = 'ios' | 'android' | 'web';

/**
 * Health Service Class
 * Provides unified interface for health data from different platforms
 */
export class HealthService {
  private platform: Platform;
  private isCapacitorAvailable: boolean;

  constructor() {
    // Detect platform
    this.platform = this.detectPlatform();
    this.isCapacitorAvailable = this.checkCapacitorAvailability();
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): Platform {
    if (typeof window === 'undefined') return 'web';
    
    // Check for iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) return 'ios';
    
    // Check for Android
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isAndroid) return 'android';
    
    return 'web';
  }

  /**
   * Check if Capacitor is available (native plugins loaded)
   */
  private checkCapacitorAvailability(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      // Check if Capacitor is available
      const Capacitor = (window as any).Capacitor;
      if (!Capacitor) return false;
      
      // Check if we're on a native platform
      return Capacitor.isNativePlatform && Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  /**
   * Check if health APIs are available on current platform
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isCapacitorAvailable) {
      logger.warn('Health APIs not available: Capacitor not loaded');
      return false;
    }

    if (this.platform === 'web') {
      logger.warn('Health APIs not available: Web platform');
      return false;
    }

    try {
      const Capacitor = (window as any).Capacitor;
      
      if (this.platform === 'ios') {
        const HealthKit = Capacitor?.Plugins?.HealthKitPlugin;
        if (!HealthKit) return false;
        
        const result = await HealthKit.isAvailable({});
        return result?.available === true;
      }
      
      if (this.platform === 'android') {
        const HealthConnect = Capacitor?.Plugins?.HealthConnectPlugin;
        if (!HealthConnect) return false;
        
        const result = await HealthConnect.isAvailable({});
        return result?.available === true;
      }
    } catch (error) {
      logger.error('Error checking health API availability:', error);
      return false;
    }

    return false;
  }

  /**
   * Request permissions for health data access
   */
  async requestPermissions(): Promise<boolean> {
    if (!await this.isAvailable()) {
      logger.warn('Cannot request permissions: Health APIs not available');
      return false;
    }

    try {
      if (this.platform === 'ios') {
        return await this.requestIOSPermissions();
      } else if (this.platform === 'android') {
        return await this.requestAndroidPermissions();
      }
      return false;
    } catch (error) {
      logger.error('Error requesting health permissions:', error);
      return false;
    }
  }

  /**
   * Check if permissions are granted
   */
  async checkPermissions(): Promise<boolean> {
    if (!await this.isAvailable()) {
      return false;
    }

    try {
      if (this.platform === 'ios') {
        return await this.checkIOSPermissions();
      } else if (this.platform === 'android') {
        return await this.checkAndroidPermissions();
      }
      return false;
    } catch (error) {
      logger.error('Error checking health permissions:', error);
      return false;
    }
  }

  /**
   * Get health data for a date range
   */
  async getHealthData(startDate: Date, endDate: Date): Promise<HealthData | null> {
    if (!await this.isAvailable()) {
      logger.warn('Cannot get health data: Health APIs not available');
      return null;
    }

    if (!await this.checkPermissions()) {
      logger.warn('Cannot get health data: Permissions not granted');
      return null;
    }

    try {
      if (this.platform === 'ios') {
        return await this.getIOSHealthData(startDate, endDate);
      } else if (this.platform === 'android') {
        return await this.getAndroidHealthData(startDate, endDate);
      }
      return null;
    } catch (error) {
      logger.error('Error getting health data:', error);
      return null;
    }
  }

  /**
   * Sync today's health data
   */
  async syncTodayData(): Promise<HealthData | null> {
    try {
      // 1. Verify connection
      if (!await this.checkPermissions()) {
        throw new Error('PERMISSIONS_REVOKED');
      }

      // 2. Attempt fetch with timeout
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('SYNC_TIMEOUT')), 10000)
      );

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      const dataPromise = this.getHealthData(startOfDay, endOfDay);

      const data = await Promise.race([dataPromise, timeoutPromise]) as HealthData | null;

      // 3. Validate received data
      if (!data || Object.keys(data).length === 0) {
        throw new Error('NO_DATA_AVAILABLE');
      }

      // 4. Validate data ranges
      const validation = this.validateHealthData(data);
      if (!validation.isValid) {
        logger.warn('Health data validation failed:', validation.errors);
        // Still return data but with warnings
      }

      return data;

    } catch (error: any) {
      logger.error('Health sync failed:', error);

      // Classify errors for UI
      if (error.message === 'PERMISSIONS_REVOKED') {
        return null; // User must reconnect manually
      }

      if (error.message === 'SYNC_TIMEOUT') {
        // Retry once
        logger.warn('Sync timeout, retrying once...');
        return await this.syncTodayData();
      }

      return null; // Other errors: degraded mode
    }
  }

  /**
   * Validate health data ranges
   */
  validateHealthData(data: HealthData): HealthDataValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate BBT
    if (data.basalBodyTemperature !== undefined) {
      if (data.basalBodyTemperature < HEALTH_DATA_RANGES.bbt.min || 
          data.basalBodyTemperature > HEALTH_DATA_RANGES.bbt.max) {
        errors.push(`BBT fuera de rango: ${data.basalBodyTemperature}°C (esperado: ${HEALTH_DATA_RANGES.bbt.min}-${HEALTH_DATA_RANGES.bbt.max}°C)`);
      }
    }

    // Validate HRV
    if (data.heartRateVariability !== undefined) {
      if (data.heartRateVariability < HEALTH_DATA_RANGES.hrv.min || 
          data.heartRateVariability > HEALTH_DATA_RANGES.hrv.max) {
        warnings.push(`HRV fuera de rango típico: ${data.heartRateVariability}ms`);
      }
    }

    // Validate sleep duration
    if (data.sleepDurationMinutes !== undefined) {
      if (data.sleepDurationMinutes < HEALTH_DATA_RANGES.sleepDuration.min || 
          data.sleepDurationMinutes > HEALTH_DATA_RANGES.sleepDuration.max) {
        warnings.push(`Duración de sueño inusual: ${data.sleepDurationMinutes} minutos`);
      }
    }

    // Validate resting heart rate
    if (data.restingHeartRate !== undefined) {
      if (data.restingHeartRate < HEALTH_DATA_RANGES.restingHeartRate.min || 
          data.restingHeartRate > HEALTH_DATA_RANGES.restingHeartRate.max) {
        warnings.push(`Frecuencia cardíaca en reposo fuera de rango típico: ${data.restingHeartRate} bpm`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Reconnect to health services
   */
  async reconnect(): Promise<boolean> {
    try {
      // Clear any cached connection status
      localStorage.removeItem('fertyfit_wearable_connected');
      
      // Request permissions again
      const granted = await this.requestPermissions();
      
      if (granted) {
        // Test sync
        const testData = await this.syncTodayData();
        return testData !== null;
      }
      
      return false;
    } catch (error) {
      logger.error('Error reconnecting to health services:', error);
      return false;
    }
  }

  // ========== iOS HealthKit Methods ==========

  /**
   * Request iOS HealthKit permissions
   */
  private async requestIOSPermissions(): Promise<boolean> {
    try {
      const Capacitor = (window as any).Capacitor;
      const HealthKit = Capacitor?.Plugins?.HealthKitPlugin;
      
      if (!HealthKit) {
        logger.warn('HealthKit plugin not available');
        return false;
      }

      const result = await HealthKit.requestAuthorization({
        read: [
          'bodyTemperature',
          'sleepAnalysis',
          'stepCount',
          'activeEnergyBurned',
          'heartRate',
          'heartRateVariabilitySDNN',
          'oxygenSaturation',
          'respiratoryRate'
        ]
      });

      return result?.granted === true;
    } catch (error) {
      logger.error('Error requesting iOS permissions:', error);
      return false;
    }
  }

  /**
   * Check iOS HealthKit permissions
   */
  private async checkIOSPermissions(): Promise<boolean> {
    try {
      const Capacitor = (window as any).Capacitor;
      const HealthKit = Capacitor?.Plugins?.HealthKitPlugin;
      
      if (!HealthKit) {
        return false;
      }

      const result = await HealthKit.checkAuthorization({
        read: ['bodyTemperature', 'sleepAnalysis', 'stepCount']
      });

      return result?.granted === true;
    } catch (error) {
      logger.error('Error checking iOS permissions:', error);
      return false;
    }
  }

  /**
   * Get health data from iOS HealthKit
   */
  private async getIOSHealthData(startDate: Date, endDate: Date): Promise<HealthData | null> {
    try {
      const Capacitor = (window as any).Capacitor;
      const HealthKit = Capacitor?.Plugins?.HealthKitPlugin;
      
      if (!HealthKit) {
        logger.warn('HealthKit plugin not available');
        return null;
      }

      const healthData: HealthData = {
        source: 'Apple HealthKit',
        syncedAt: new Date().toISOString(),
        deviceName: 'Apple Watch'
      };

      // Get Basal Body Temperature
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'bodyTemperature',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          const latest = samples.sort((a: any, b: any) => 
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )[0];
          healthData.basalBodyTemperature = latest.value;
        }
      } catch (error) {
        logger.warn('Could not fetch BBT from HealthKit:', error);
      }

      // Get Sleep Analysis
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'sleepAnalysis',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          let totalSleep = 0;
          let deepSleep = 0;
          let remSleep = 0;
          let lightSleep = 0;

          samples.forEach((sample: any) => {
            const duration = (new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime()) / (1000 * 60);
            totalSleep += duration;
            
            if (sample.value === 'ASLEEP.DEEP') {
              deepSleep += duration;
            } else if (sample.value === 'ASLEEP.REM') {
              remSleep += duration;
            } else if (sample.value === 'ASLEEP.CORE' || sample.value === 'ASLEEP.UNSPECIFIED') {
              lightSleep += duration;
            }
          });

          healthData.sleepDurationMinutes = Math.round(totalSleep);
          healthData.sleepDeepMinutes = Math.round(deepSleep);
          healthData.sleepRemMinutes = Math.round(remSleep);
          healthData.sleepLightMinutes = Math.round(lightSleep);
          
          // Calculate sleep quality (1-5) based on deep + REM sleep percentage
          const qualitySleepPercent = totalSleep > 0 ? ((deepSleep + remSleep) / totalSleep) * 100 : 0;
          if (qualitySleepPercent >= 40) healthData.sleepQuality = 5;
          else if (qualitySleepPercent >= 30) healthData.sleepQuality = 4;
          else if (qualitySleepPercent >= 20) healthData.sleepQuality = 3;
          else if (qualitySleepPercent >= 10) healthData.sleepQuality = 2;
          else healthData.sleepQuality = 1;
        }
      } catch (error) {
        logger.warn('Could not fetch sleep data from HealthKit:', error);
      }

      // Get Steps
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'stepCount',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          healthData.steps = samples.reduce((sum: number, sample: any) => sum + (sample.value || 0), 0);
        }
      } catch (error) {
        logger.warn('Could not fetch steps from HealthKit:', error);
      }

      // Get Active Calories
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'activeEnergyBurned',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          healthData.activeCalories = Math.round(
            samples.reduce((sum: number, sample: any) => sum + (sample.value || 0), 0)
          );
        }
      } catch (error) {
        logger.warn('Could not fetch active calories from HealthKit:', error);
      }

      // Get Heart Rate Variability
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'heartRateVariabilitySDNN',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          const avgHRV = samples.reduce((sum: number, sample: any) => sum + (sample.value || 0), 0) / samples.length;
          healthData.heartRateVariability = Math.round(avgHRV);
        }
      } catch (error) {
        logger.warn('Could not fetch HRV from HealthKit:', error);
      }

      // Get Resting Heart Rate
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'heartRate',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          const restingHR = samples
            .filter((sample: any) => sample.value < 100)
            .sort((a: any, b: any) => a.value - b.value)[0];
          if (restingHR) {
            healthData.restingHeartRate = Math.round(restingHR.value);
          }
        }
      } catch (error) {
        logger.warn('Could not fetch heart rate from HealthKit:', error);
      }

      // Get Oxygen Saturation
      try {
        const result = await HealthKit.querySampleType({
          sampleType: 'oxygenSaturation',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
        const samples = result?.samples || [];
        if (samples.length > 0) {
          const latest = samples.sort((a: any, b: any) => 
            new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
          )[0];
          healthData.oxygenSaturation = Math.round(latest.value * 100);
        }
      } catch (error) {
        logger.warn('Could not fetch SpO2 from HealthKit:', error);
      }

      return Object.keys(healthData).length > 3 ? healthData : null; // More than just metadata
    } catch (error) {
      logger.error('Error getting iOS health data:', error);
      return null;
    }
  }

  // ========== Android Health Connect Methods ==========

  /**
   * Request Android Health Connect permissions
   */
  private async requestAndroidPermissions(): Promise<boolean> {
    try {
      const Capacitor = (window as any).Capacitor;
      const HealthConnect = Capacitor?.Plugins?.HealthConnectPlugin;
      
      if (!HealthConnect) {
        logger.warn('Health Connect plugin not available');
        return false;
      }

      const result = await HealthConnect.requestAuthorization({
        read: [
          'BodyTemperature',
          'SleepSession',
          'Steps',
          'ActiveCaloriesBurned',
          'HeartRate',
          'HeartRateVariabilityRmssd',
          'OxygenSaturation',
          'RespiratoryRate'
        ]
      });

      return result?.granted === true;
    } catch (error) {
      logger.error('Error requesting Android permissions:', error);
      return false;
    }
  }

  /**
   * Check Android Health Connect permissions
   */
  private async checkAndroidPermissions(): Promise<boolean> {
    try {
      const Capacitor = (window as any).Capacitor;
      const HealthConnect = Capacitor?.Plugins?.HealthConnectPlugin;
      
      if (!HealthConnect) {
        return false;
      }

      const result = await HealthConnect.checkAuthorization({
        read: ['BodyTemperature', 'SleepSession', 'Steps']
      });

      return result?.granted === true;
    } catch (error) {
      logger.error('Error checking Android permissions:', error);
      return false;
    }
  }

  /**
   * Get health data from Android Health Connect
   */
  private async getAndroidHealthData(startDate: Date, endDate: Date): Promise<HealthData | null> {
    try {
      const Capacitor = (window as any).Capacitor;
      const HealthConnect = Capacitor?.Plugins?.HealthConnectPlugin;
      
      if (!HealthConnect) {
        logger.warn('Health Connect plugin not available');
        return null;
      }

      const healthData: HealthData = {
        source: 'Google Health Connect',
        syncedAt: new Date().toISOString(),
        deviceName: 'Unknown' // Will be determined from device metadata
      };

      // Get Basal Body Temperature
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'BodyTemperature',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        const records = result?.records || [];
        if (records.length > 0) {
          const latest = records.sort((a: any, b: any) => 
            new Date(b.time).getTime() - new Date(a.time).getTime()
          )[0];
          healthData.basalBodyTemperature = latest.temperature;
        }
      } catch (error) {
        logger.warn('Could not fetch BBT from Health Connect:', error);
      }

      // Get Sleep Session
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'SleepSession',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        const sessions = result?.records || [];
        if (sessions.length > 0) {
          let totalSleep = 0;
          let deepSleep = 0;
          let remSleep = 0;
          let lightSleep = 0;

          sessions.forEach((session: any) => {
            const duration = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60);
            totalSleep += duration;

            if (session.stages && Array.isArray(session.stages)) {
              session.stages.forEach((stage: any) => {
                const stageDuration = (new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime()) / (1000 * 60);
                if (stage.stage === 4) { // Deep sleep
                  deepSleep += stageDuration;
                } else if (stage.stage === 5) { // REM sleep
                  remSleep += stageDuration;
                } else { // Light sleep
                  lightSleep += stageDuration;
                }
              });
            }
          });

          healthData.sleepDurationMinutes = Math.round(totalSleep);
          healthData.sleepDeepMinutes = Math.round(deepSleep);
          healthData.sleepRemMinutes = Math.round(remSleep);
          healthData.sleepLightMinutes = Math.round(lightSleep);
          
          // Calculate sleep quality
          const qualitySleepPercent = totalSleep > 0 ? ((deepSleep + remSleep) / totalSleep) * 100 : 0;
          if (qualitySleepPercent >= 40) healthData.sleepQuality = 5;
          else if (qualitySleepPercent >= 30) healthData.sleepQuality = 4;
          else if (qualitySleepPercent >= 20) healthData.sleepQuality = 3;
          else if (qualitySleepPercent >= 10) healthData.sleepQuality = 2;
          else healthData.sleepQuality = 1;
        }
      } catch (error) {
        logger.warn('Could not fetch sleep data from Health Connect:', error);
      }

      // Get Steps
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'Steps',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        if (result?.total !== undefined) {
          healthData.steps = result.total;
        } else if (result?.records && result.records.length > 0) {
          healthData.steps = result.records.reduce((sum: number, record: any) => sum + (record.count || 0), 0);
        }
      } catch (error) {
        logger.warn('Could not fetch steps from Health Connect:', error);
      }

      // Get Active Calories
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'ActiveCaloriesBurned',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        if (result?.total !== undefined) {
          healthData.activeCalories = Math.round(result.total);
        } else if (result?.records && result.records.length > 0) {
          healthData.activeCalories = Math.round(
            result.records.reduce((sum: number, record: any) => sum + (record.energy || 0), 0)
          );
        }
      } catch (error) {
        logger.warn('Could not fetch active calories from Health Connect:', error);
      }

      // Get Heart Rate Variability
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'HeartRateVariabilityRmssd',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        const records = result?.records || [];
        if (records.length > 0) {
          const avgHRV = records.reduce((sum: number, record: any) => sum + (record.heartRateVariabilityMillis || 0), 0) / records.length;
          healthData.heartRateVariability = Math.round(avgHRV);
        }
      } catch (error) {
        logger.warn('Could not fetch HRV from Health Connect:', error);
      }

      // Get Resting Heart Rate
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'HeartRate',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        const records = result?.records || [];
        if (records.length > 0) {
          const restingHR = records
            .filter((record: any) => record.beatsPerMinute < 100)
            .sort((a: any, b: any) => a.beatsPerMinute - b.beatsPerMinute)[0];
          if (restingHR) {
            healthData.restingHeartRate = Math.round(restingHR.beatsPerMinute);
          }
        }
      } catch (error) {
        logger.warn('Could not fetch heart rate from Health Connect:', error);
      }

      // Get Oxygen Saturation
      try {
        const result = await HealthConnect.readRecords({
          recordType: 'OxygenSaturation',
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString()
        });
        const records = result?.records || [];
        if (records.length > 0) {
          const latest = records.sort((a: any, b: any) => 
            new Date(b.time).getTime() - new Date(a.time).getTime()
          )[0];
          healthData.oxygenSaturation = Math.round(latest.percentage);
        }
      } catch (error) {
        logger.warn('Could not fetch SpO2 from Health Connect:', error);
      }

      return Object.keys(healthData).length > 3 ? healthData : null;
    } catch (error) {
      logger.error('Error getting Android health data:', error);
      return null;
    }
  }

}

// Export singleton instance
export const healthService = new HealthService();
