/**
 * Custom hook for daily notification checks
 * Handles DAILY_CHECK rule evaluation and notification scheduling
 * 
 * ✅ Optimizado para escalabilidad y UX:
 * - No ejecuta durante login (mejor performance)
 * - Valida arrays antes de usar (previene errores)
 * - Manejo robusto de errores (no rompe la app)
 */

import { useEffect, useState, useRef } from 'react';
import { formatDateForDB } from '../services/dataService';
import { fetchNotificationsForUser } from '../services/userDataService';
import { logger } from '../lib/logger';
import { useAppStore } from '../store/useAppStore';
import { evaluateRules } from '../services/RuleEngine';
import { buildRuleContext } from '../services/buildRuleContext';

export function useDailyNotifications() {
  const { user, logs, courseModules, setNotifications, view } = useAppStore();
  const [lastDailyCheckDate, setLastDailyCheckDate] = useState<string | null>(null);
  const isRunningRef = useRef(false);

  useEffect(() => {
    // ✅ OPTIMIZACIÓN 1: No ejecutar durante login/onboarding
    if (view === 'ONBOARDING' || !user?.id) return;
    
    // ✅ OPTIMIZACIÓN 2: Validar datos de ciclo antes de continuar
    if (!user.lastPeriodDate || !user.cycleLength) {
      return;
    }

    // ✅ OPTIMIZACIÓN 3: Validar arrays para prevenir errores
    const safeLogs = Array.isArray(logs) ? logs : [];
    const safeModules = Array.isArray(courseModules) ? courseModules : [];

    const todayKey = `fertyfit_daily_check_${user.id}`;
    const todayStr = formatDateForDB(new Date());
    const storedCheckDate = localStorage.getItem(todayKey);
    if (storedCheckDate === todayStr || lastDailyCheckDate === todayStr) {
      return; // Already checked today
    }

    // ✅ Prevenir ejecuciones simultáneas
    if (isRunningRef.current) {
      return;
    }

    let cancelled = false;
    isRunningRef.current = true;

    const runDailyCheck = async () => {
      try {
        // Double-check antes de ejecutar
        const doubleCheckDate = localStorage.getItem(todayKey);
        if (doubleCheckDate === todayStr) {
          return;
        }

        // Marcar como ejecutado ANTES de ejecutar para prevenir duplicados
        localStorage.setItem(todayKey, todayStr);
        setLastDailyCheckDate(todayStr);

        const context = await buildRuleContext(user, safeLogs, safeModules);
        await evaluateRules('DAILY_CHECK', context, user.id!);

        if (!cancelled) {
          const result = await fetchNotificationsForUser(user.id);
          if (result.success) {
            setNotifications(result.data);
          }
        }
      } catch (err) {
        // Si hay error, limpiar para permitir reintento
        localStorage.removeItem(todayKey);
        setLastDailyCheckDate(null);
        logger.error('❌ Error running DAILY_CHECK trigger', err);
      } finally {
        isRunningRef.current = false;
      }
    };

    runDailyCheck();

    return () => { 
      cancelled = true;
      isRunningRef.current = false;
    };
  }, [user?.id, user?.lastPeriodDate, user?.cycleLength, view]);
}

