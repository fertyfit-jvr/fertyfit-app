/**
 * Hook for managing health data and wearable connection
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  HealthData, 
  WearableConnectionStatus, 
  ConnectionState 
} from '../types/health';
import { healthService } from '../services/healthService';
import { syncManager } from '../services/syncManager';
import { logger } from '../lib/logger';

/**
 * Hook for managing health data and wearable connection
 * 
 * @param userId - User ID
 */
export const useHealthData = (userId: string | undefined) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('unavailable');
  const [connectionStatus, setConnectionStatus] = useState<WearableConnectionStatus | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Check if health APIs are available
   */
  const checkAvailability = useCallback(async () => {
    const available = await healthService.isAvailable();
    if (!available) {
      setConnectionState('unavailable');
      return false;
    }
    return true;
  }, []);

  /**
   * Check connection status from database
   */
  const loadConnectionStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const status = await syncManager.getWearableConnectionStatus(userId);
      if (status) {
        setConnectionStatus({
          isConnected: status.isConnected,
          lastSync: status.lastSync,
          deviceType: status.deviceType as any,
          permissionsGranted: status.permissionsGranted,
          platform: healthService['platform'] as 'ios' | 'android' | 'web'
        });

        if (status.isConnected) {
          setConnectionState('connected');
        } else {
          setConnectionState('disconnected');
        }
      } else {
        setConnectionState('disconnected');
      }
    } catch (error) {
      logger.error('Error loading connection status:', error);
      setConnectionState('disconnected');
    }
  }, [userId]);

  /**
   * Connect to wearable
   */
  const connect = useCallback(async () => {
    setIsLoading(true);
    setConnectionState('connecting');

    try {
      // Check availability
      const available = await checkAvailability();
      if (!available) {
        setConnectionState('unavailable');
        setIsLoading(false);
        return { success: false, error: 'Health APIs not available on this device' };
      }

      // Request permissions
      const granted = await healthService.requestPermissions();
      if (!granted) {
        setConnectionState('error_permissions');
        setIsLoading(false);
        return { success: false, error: 'Permissions denied' };
      }

      // Test sync
      const testData = await healthService.syncTodayData();
      if (!testData) {
        setConnectionState('error_sync');
        setIsLoading(false);
        return { success: false, error: 'Could not sync data' };
      }

      // Save connection status
      if (userId) {
        await syncManager.updateWearableConnectionStatus(userId, {
          isConnected: true,
          lastSync: new Date(),
          deviceType: testData.deviceName,
          permissionsGranted: true
        });
      }

      localStorage.setItem('fertyfit_wearable_connected', 'true');
      setConnectionState('connected');
      setHealthData(testData);
      setIsLoading(false);

      return { success: true, data: testData };
    } catch (error: any) {
      logger.error('Error connecting to wearable:', error);
      setConnectionState('error_sync');
      setIsLoading(false);
      return { success: false, error: error.message || 'Connection failed' };
    }
  }, [userId, checkAvailability]);

  /**
   * Disconnect from wearable
   */
  const disconnect = useCallback(async () => {
    if (!userId) return;

    try {
      await syncManager.updateWearableConnectionStatus(userId, {
        isConnected: false,
        lastSync: null,
        permissionsGranted: false
      });

      localStorage.removeItem('fertyfit_wearable_connected');
      setConnectionState('disconnected');
      setConnectionStatus(null);
      setHealthData(null);
    } catch (error) {
      logger.error('Error disconnecting wearable:', error);
    }
  }, [userId]);

  /**
   * Sync health data
   */
  const sync = useCallback(async () => {
    if (!userId) return { success: false, error: 'No user ID' };

    setIsLoading(true);
    setConnectionState('syncing');

    try {
      const result = await syncManager.syncWithFallback(userId);

      if (result.success && result.data) {
        setHealthData(result.data);
        setConnectionState('connected');
        
        if (result.mode === 'wearable') {
          setConnectionStatus(prev => prev ? {
            ...prev,
            lastSync: new Date(),
            isConnected: true
          } : null);
        }

        setIsLoading(false);
        return { success: true, data: result.data, mode: result.mode };
      } else {
        setConnectionState('error_sync');
        setIsLoading(false);
        return { success: false, errors: result.errors };
      }
    } catch (error: any) {
      logger.error('Error syncing health data:', error);
      setConnectionState('error_sync');
      setIsLoading(false);
      return { success: false, error: error.message || 'Sync failed' };
    }
  }, [userId]);

  /**
   * Reconnect to wearable
   */
  const reconnect = useCallback(async () => {
    const success = await healthService.reconnect();
    if (success && userId) {
      await loadConnectionStatus();
      await sync();
    }
    return success;
  }, [userId, loadConnectionStatus, sync]);

  // Load connection status on mount
  useEffect(() => {
    checkAvailability();
    if (userId) {
      loadConnectionStatus();
    }
  }, [userId, checkAvailability, loadConnectionStatus]);

  return {
    connectionState,
    connectionStatus,
    healthData,
    isLoading,
    connect,
    disconnect,
    sync,
    reconnect,
    checkAvailability
  };
};

