/**
 * Hook for automatic health data synchronization
 * Handles periodic sync when wearable is connected
 */

import { useState, useEffect, useRef } from 'react';
import { healthService } from '../services/healthService';
import { syncManager } from '../services/syncManager';
import { logger } from '../lib/logger';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

/**
 * Hook for automatic health data synchronization
 * 
 * @param userId - User ID
 * @param enabled - Whether auto-sync is enabled
 * @param intervalMinutes - Sync interval in minutes (default: 30)
 */
export const useAutoSync = (
  userId: string | undefined,
  enabled: boolean = true,
  intervalMinutes: number = 30
) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    // Check if wearable is connected
    const isConnected = localStorage.getItem('fertyfit_wearable_connected') === 'true';
    if (!isConnected) {
      return;
    }

    // Initial sync on mount
    const performSync = async () => {
      if (isSyncingRef.current) {
        return; // Prevent concurrent syncs
      }

      try {
        isSyncingRef.current = true;
        setSyncStatus('syncing');

        const result = await syncManager.syncWithFallback(userId);

        if (result.success && result.mode === 'wearable') {
          setSyncStatus('success');
          setLastSyncTime(new Date());
          logger.log('✅ Auto-sync successful');
        } else {
          setSyncStatus('error');
          logger.warn('Auto-sync completed with fallback or errors:', result.errors);
        }
      } catch (error) {
        setSyncStatus('error');
        logger.error('Auto-sync error:', error);
      } finally {
        isSyncingRef.current = false;
        // Reset status to idle after 3 seconds
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    };

    // Perform initial sync
    performSync();

    // Set up periodic sync
    intervalRef.current = setInterval(() => {
      performSync();
    }, intervalMinutes * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, enabled, intervalMinutes]);

  /**
   * Manual sync trigger
   */
  const triggerSync = async () => {
    if (!userId || isSyncingRef.current) {
      return;
    }

    try {
      isSyncingRef.current = true;
      setSyncStatus('syncing');

      const result = await syncManager.syncWithFallback(userId);

      if (result.success) {
        setSyncStatus('success');
        setLastSyncTime(new Date());
        return { success: true, mode: result.mode };
      } else {
        setSyncStatus('error');
        return { success: false, errors: result.errors };
      }
    } catch (error) {
      setSyncStatus('error');
      logger.error('Manual sync error:', error);
      return { success: false, error };
    } finally {
      isSyncingRef.current = false;
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
  };

  return {
    syncStatus,
    lastSyncTime,
    triggerSync,
    isSyncing: syncStatus === 'syncing'
  };
};

