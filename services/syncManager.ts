/**
 * Sync Manager for Health Data
 * Handles synchronization with fallback strategies and error recovery
 */

import { HealthData, SyncResult } from '../types/health';
import { DailyLog } from '../types';
import { healthService } from './healthService';
import { supabase } from './supabase';
import { logger } from '../lib/logger';
import { formatDateForDB } from './dataService';

/**
 * Sync Manager Class
 * Orchestrates health data synchronization with robust fallback mechanisms
 */
export class SyncManager {
  /**
   * Sync health data with fallback strategy
   */
  async syncWithFallback(userId: string, date?: string): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      data: null,
      errors: [],
      mode: 'none',
      timestamp: new Date()
    };

    const targetDate = date || formatDateForDB(new Date());

    // 1. Try wearable sync first
    try {
      const healthData = await healthService.syncTodayData();

      if (healthData && Object.keys(healthData).length > 0) {
        result.data = healthData;
        result.success = true;
        result.mode = 'wearable';

        // Save to database
        await this.saveHealthData(userId, healthData, targetDate);

        logger.log('✅ Wearable sync successful:', { userId, date: targetDate });
        return result;
      }
    } catch (error: any) {
      result.errors.push({ 
        type: 'wearable_sync', 
        message: error.message || 'Unknown error during wearable sync' 
      });
      logger.warn('Wearable sync failed, trying fallback:', error);
    }

    // 2. Fallback: Load existing manual data for today
    try {
      const manualData = await this.getManualData(userId, targetDate);
      if (manualData) {
        result.data = this.convertDailyLogToHealthData(manualData);
        result.mode = 'manual';
        result.success = true;
        logger.log('✅ Using manual data as fallback:', { userId, date: targetDate });
        return result;
      }
    } catch (error: any) {
      result.errors.push({ 
        type: 'manual_fallback', 
        message: error.message || 'Could not load manual data' 
      });
    }

    // 3. If both failed, return empty result
    logger.warn('All sync strategies failed:', result.errors);
    return result;
  }

  /**
   * Save health data to database
   */
  async saveHealthData(
    userId: string, 
    healthData: HealthData, 
    date: string
  ): Promise<void> {
    try {
      // Get existing log for this date
      const { data: existingLog, error: fetchError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Prepare update data
      const updateData: any = {
        health_data: healthData,
        data_source: existingLog?.data_source === 'manual' ? 'hybrid' : 'wearable',
        updated_at: new Date().toISOString()
      };

      // Map health data to daily_log columns
      if (healthData.basalBodyTemperature !== undefined) {
        updateData.bbt = healthData.basalBodyTemperature;
      }

      if (healthData.sleepDurationMinutes !== undefined) {
        updateData.sleep_hours = healthData.sleepDurationMinutes / 60;
      }

      if (healthData.sleepDeepMinutes !== undefined) {
        updateData.sleep_deep_minutes = healthData.sleepDeepMinutes;
      }

      if (healthData.sleepRemMinutes !== undefined) {
        updateData.sleep_rem_minutes = healthData.sleepRemMinutes;
      }

      if (healthData.sleepLightMinutes !== undefined) {
        updateData.sleep_light_minutes = healthData.sleepLightMinutes;
      }

      if (healthData.sleepQuality !== undefined) {
        updateData.sleep_quality = healthData.sleepQuality;
      }

      if (healthData.heartRateVariability !== undefined) {
        updateData.hrv = healthData.heartRateVariability;
      }

      if (healthData.restingHeartRate !== undefined) {
        updateData.resting_heart_rate = healthData.restingHeartRate;
      }

      if (healthData.steps !== undefined) {
        updateData.steps = healthData.steps;
      }

      if (healthData.activeCalories !== undefined) {
        updateData.active_calories = healthData.activeCalories;
      }

      if (healthData.activityMinutes !== undefined) {
        updateData.activity_minutes = healthData.activityMinutes;
      }

      if (healthData.oxygenSaturation !== undefined) {
        updateData.oxygen_saturation = healthData.oxygenSaturation;
      }

      if (healthData.respiratoryRate !== undefined) {
        updateData.respiratory_rate = healthData.respiratoryRate;
      }

      // Update or insert
      if (existingLog) {
        const { error: updateError } = await supabase
          .from('daily_logs')
          .update(updateData)
          .eq('id', existingLog.id);

        if (updateError) throw updateError;
      } else {
        // Create new log with health data
        const { error: insertError } = await supabase
          .from('daily_logs')
          .insert({
            user_id: userId,
            date: date,
            ...updateData,
            // Required fields with defaults
            cycle_day: 1,
            mucus: '',
            lh_test: 'No realizado',
            symptoms: [],
            sex: false,
            alcohol: false,
            water_glasses: 0,
            veggie_servings: 0,
            sun_minutes: 0
          });

        if (insertError) throw insertError;
      }

      // Update wearable connection status
      await this.updateWearableConnectionStatus(userId, {
        isConnected: true,
        lastSync: new Date(),
        deviceType: healthData.deviceName,
        permissionsGranted: true
      });

    } catch (error) {
      logger.error('Error saving health data:', error);
      throw error;
    }
  }

  /**
   * Get manual data for a specific date
   */
  private async getManualData(userId: string, date: string): Promise<DailyLog | null> {
    try {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      logger.error('Error getting manual data:', error);
      return null;
    }
  }

  /**
   * Convert DailyLog to HealthData format
   */
  private convertDailyLogToHealthData(log: DailyLog): HealthData {
    return {
      source: 'Manual',
      syncedAt: new Date().toISOString(),
      basalBodyTemperature: log.bbt || undefined,
      sleepDurationMinutes: log.sleepHours ? log.sleepHours * 60 : undefined,
      sleepQuality: log.sleepQuality as any,
      activityMinutes: log.activityMinutes,
      steps: log.steps,
      activeCalories: log.activeCalories,
      heartRateVariability: log.heartRateVariability,
      restingHeartRate: log.restingHeartRate,
      sleepDeepMinutes: log.sleepPhases?.deep,
      sleepRemMinutes: log.sleepPhases?.rem,
      sleepLightMinutes: log.sleepPhases?.light,
      oxygenSaturation: log.oxygenSaturation,
      respiratoryRate: log.respiratoryRate
    };
  }

  /**
   * Update wearable connection status in database
   */
  async updateWearableConnectionStatus(
    userId: string,
    status: {
      isConnected: boolean;
      lastSync: Date | null;
      deviceType?: string;
      deviceName?: string;
      permissionsGranted: boolean;
      errorCode?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('wearable_connections')
        .upsert({
          user_id: userId,
          is_connected: status.isConnected,
          last_sync_at: status.lastSync?.toISOString() || null,
          device_type: status.deviceType,
          device_name: status.deviceName,
          permissions_granted: status.permissionsGranted,
          error_code: status.errorCode,
          error_message: status.errorMessage,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Error updating wearable connection status:', error);
    }
  }

  /**
   * Get wearable connection status from database
   */
  async getWearableConnectionStatus(userId: string): Promise<{
    isConnected: boolean;
    lastSync: Date | null;
    deviceType?: string;
    permissionsGranted: boolean;
  } | null> {
    try {
      const { data, error } = await supabase
        .from('wearable_connections')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data) return null;

      return {
        isConnected: data.is_connected,
        lastSync: data.last_sync_at ? new Date(data.last_sync_at) : null,
        deviceType: data.device_type,
        permissionsGranted: data.permissions_granted
      };
    } catch (error) {
      logger.error('Error getting wearable connection status:', error);
      return null;
    }
  }

  /**
   * Merge wearable data with existing manual data
   * Creates hybrid data source
   */
  async mergeHealthData(
    userId: string,
    healthData: HealthData,
    date: string
  ): Promise<void> {
    try {
      // Get existing log
      const { data: existingLog } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .single();

      if (!existingLog) {
        // No existing log, just save wearable data
        await this.saveHealthData(userId, healthData, date);
        return;
      }

      // Merge: wearable data takes precedence for health metrics
      // but preserve manual entries for other fields
      const mergedData: any = {
        health_data: healthData,
        data_source: 'hybrid',
        updated_at: new Date().toISOString()
      };

      // Only update fields that come from wearable
      if (healthData.basalBodyTemperature !== undefined) {
        mergedData.bbt = healthData.basalBodyTemperature;
      }

      if (healthData.sleepDurationMinutes !== undefined) {
        mergedData.sleep_hours = healthData.sleepDurationMinutes / 60;
      }

      if (healthData.sleepDeepMinutes !== undefined) {
        mergedData.sleep_deep_minutes = healthData.sleepDeepMinutes;
      }

      if (healthData.sleepRemMinutes !== undefined) {
        mergedData.sleep_rem_minutes = healthData.sleepRemMinutes;
      }

      if (healthData.sleepLightMinutes !== undefined) {
        mergedData.sleep_light_minutes = healthData.sleepLightMinutes;
      }

      if (healthData.sleepQuality !== undefined) {
        mergedData.sleep_quality = healthData.sleepQuality;
      }

      if (healthData.heartRateVariability !== undefined) {
        mergedData.hrv = healthData.heartRateVariability;
      }

      if (healthData.restingHeartRate !== undefined) {
        mergedData.resting_heart_rate = healthData.restingHeartRate;
      }

      if (healthData.steps !== undefined) {
        mergedData.steps = healthData.steps;
      }

      if (healthData.activeCalories !== undefined) {
        mergedData.active_calories = healthData.activeCalories;
      }

      if (healthData.activityMinutes !== undefined) {
        mergedData.activity_minutes = healthData.activityMinutes;
      }

      // Update log
      const { error } = await supabase
        .from('daily_logs')
        .update(mergedData)
        .eq('id', existingLog.id);

      if (error) throw error;

      logger.log('✅ Health data merged successfully:', { userId, date });
    } catch (error) {
      logger.error('Error merging health data:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const syncManager = new SyncManager();
