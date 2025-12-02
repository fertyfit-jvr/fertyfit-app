/**
 * Custom hook for daily notification checks
 * Handles DAILY_CHECK rule evaluation and notification scheduling
 */

import { useEffect, useState } from 'react';
import { UserProfile } from '../types';
import { supabase } from '../services/supabase';
import { evaluateRules, saveNotifications } from '../services/RuleEngine';
import { getCycleDay } from './useCycleDay';
import { formatDateForDB } from '../services/dataService';
import { fetchNotificationsForUser } from '../services/userDataService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';

export function useDailyNotifications() {
  const { user, setNotifications } = useAppStore();
  const [lastDailyCheckDate, setLastDailyCheckDate] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    if (!user.lastPeriodDate || !user.cycleLength) {
      logger.warn('🔁 Cycle tracking skipped - missing data', {
        userId: user.id,
        hasLastPeriodDate: Boolean(user.lastPeriodDate),
        hasCycleLength: Boolean(user.cycleLength)
      });
      return;
    }

    const todayKey = `fertyfit_daily_check_${user.id}`;
    const todayStr = formatDateForDB(new Date());
    
    // Check both localStorage and state to avoid redundant checks
    const storedCheckDate = localStorage.getItem(todayKey);
    if (storedCheckDate === todayStr || lastDailyCheckDate === todayStr) {
      return; // Already checked today
    }

    const currentCycleDay = getCycleDay(user.lastPeriodDate, user.cycleLength);
    if (!currentCycleDay) return;

    let cancelled = false;

    const runDailyCheck = async () => {
      try {
        const ruleNotifications = await evaluateRules('DAILY_CHECK', {
          user,
          currentCycleDay
        });

        if (!cancelled && ruleNotifications.length > 0) {
          await saveNotifications(user.id!, ruleNotifications);
          // Fetch notifications after saving
          const result = await fetchNotificationsForUser(user.id);
          if (result.success) {
            setNotifications(result.data);
          }
        }
      } catch (err) {
        logger.error('❌ Error running DAILY_CHECK trigger', err);
      } finally {
        if (!cancelled) {
          localStorage.setItem(todayKey, todayStr);
          setLastDailyCheckDate(todayStr);
        }
      }
    };

    runDailyCheck();

    return () => { cancelled = true; };
  }, [user?.id, user?.lastPeriodDate, user?.cycleLength, lastDailyCheckDate, setNotifications]);
}

