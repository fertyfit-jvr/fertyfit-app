import { useMemo } from 'react';
import { calcularDiaDelCiclo } from '../services/RuleEngine';

/**
 * Custom hook to calculate the current cycle day
 * Centralizes cycle day calculation logic to avoid duplication
 * Memoized to prevent unnecessary recalculations
 * 
 * @param lastPeriodDate - Date of last period (YYYY-MM-DD format)
 * @param cycleLength - Average cycle length in days
 * @returns Current cycle day (1-based) or 1 if data is missing
 * 
 * @example
 * const cycleDay = useCycleDay(user.lastPeriodDate, user.cycleLength);
 */
export const useCycleDay = (
  lastPeriodDate: string | undefined,
  cycleLength: number | undefined
): number => {
  return useMemo(() => {
    if (!lastPeriodDate || !cycleLength) return 1;
    const day = calcularDiaDelCiclo(lastPeriodDate, cycleLength);
    return day > 0 ? day : 1;
  }, [lastPeriodDate, cycleLength]);
};

/**
 * Helper function to calculate cycle day (for use outside React components)
 * Same logic as useCycleDay but as a pure function
 * 
 * @param lastPeriodDate - Date of last period (YYYY-MM-DD format)
 * @param cycleLength - Average cycle length in days
 * @returns Current cycle day (1-based) or 1 if data is missing
 */
export const getCycleDay = (
  lastPeriodDate: string | undefined,
  cycleLength: number | undefined
): number => {
  if (!lastPeriodDate || !cycleLength) return 1;
  const day = calcularDiaDelCiclo(lastPeriodDate, cycleLength);
  return day > 0 ? day : 1;
};

