/**
 * Custom hook for daily notification checks
 * Handles DAILY_CHECK rule evaluation and notification scheduling
 */

import { useEffect, useState } from 'react';
import { formatDateForDB } from '../services/dataService';
import { fetchNotificationsForUser } from '../services/userDataService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';
import { evaluateRules } from '../services/RuleEngine';
import { buildRuleContext } from '../services/buildRuleContext';

export function useDailyNotifications() {
  const { user, logs, courseModules, setNotifications } = useAppStore();
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
    const storedCheckDate = localStorage.getItem(todayKey);
    if (storedCheckDate === todayStr || lastDailyCheckDate === todayStr) {
      return; // Already checked today
    }

    let cancelled = false;

    const runDailyCheck = async () => {
      try {
        const context = await buildRuleContext(user, logs, courseModules);
        await evaluateRules('DAILY_CHECK', context, user.id!);

        if (!cancelled) {
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
  }, [user?.id, user?.lastPeriodDate, user?.cycleLength, logs, courseModules, lastDailyCheckDate, setNotifications]);
}

