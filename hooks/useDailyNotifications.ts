/**
 * Custom hook for daily notification checks
 * Handles DAILY_CHECK rule evaluation and notification scheduling
 * 
 * ✅ Optimizado para escalabilidad y UX:
 * - No ejecuta durante login (mejor performance)
 * - Valida arrays antes de usar (previene errores)
 * - Manejo robusto de errores (no rompe la app)
 */

import { useEffect, useState } from 'react';
import { formatDateForDB } from '../services/dataService';
import { fetchNotificationsForUser } from '../services/userDataService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';
import { evaluateRules } from '../services/RuleEngine';
import { buildRuleContext } from '../services/buildRuleContext';

export function useDailyNotifications() {
  const { user, logs, courseModules, setNotifications, view } = useAppStore();
  const [lastDailyCheckDate, setLastDailyCheckDate] = useState<string | null>(null);

  useEffect(() => {
    // ✅ OPTIMIZACIÓN 1: No ejecutar durante login/onboarding
    // Reduce llamadas innecesarias a Supabase y mejora performance
    if (view === 'ONBOARDING' || !user?.id) return;
    
    // ✅ OPTIMIZACIÓN 2: Validar datos de ciclo antes de continuar
    if (!user.lastPeriodDate || !user.cycleLength) {
      return; // Silently skip - no need to log during normal flow
    }

    // ✅ OPTIMIZACIÓN 3: Validar arrays para prevenir errores
    // Crítico para escalabilidad: previene crashes con datos inesperados
    const safeLogs = Array.isArray(logs) ? logs : [];
    const safeModules = Array.isArray(courseModules) ? courseModules : [];

    const todayKey = `fertyfit_daily_check_${user.id}`;
    const todayStr = formatDateForDB(new Date());
    const storedCheckDate = localStorage.getItem(todayKey);
    if (storedCheckDate === todayStr || lastDailyCheckDate === todayStr) {
      return; // Already checked today
    }

    let cancelled = false;

    const runDailyCheck = async () => {
      try {
        const context = await buildRuleContext(user, safeLogs, safeModules);
        await evaluateRules('DAILY_CHECK', context, user.id!);

        if (!cancelled) {
          const result = await fetchNotificationsForUser(user.id);
          if (result.success) {
            setNotifications(result.data);
          }
        }
      } catch (err) {
        // ✅ OPTIMIZACIÓN 4: Error handling silencioso
        // No rompe la app, solo loguea para debugging
        logger.error('❌ Error running DAILY_CHECK trigger', err);
        // No propagamos el error - la app debe seguir funcionando
      } finally {
        if (!cancelled) {
          localStorage.setItem(todayKey, todayStr);
          setLastDailyCheckDate(todayStr);
        }
      }
    };

    runDailyCheck();

    return () => { cancelled = true; };
  }, [user?.id, user?.lastPeriodDate, user?.cycleLength, logs, courseModules, lastDailyCheckDate, setNotifications, view]);
}

