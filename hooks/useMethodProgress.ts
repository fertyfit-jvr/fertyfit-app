import { useMemo } from 'react';
import { calculateDaysOnMethod, calculateCurrentWeek } from '../services/dataService';

/**
 * Hook compartido para calcular el progreso del método FertyFit
 * @param methodStartDate - Fecha de inicio del método (YYYY-MM-DD o timestamp)
 * @returns Objeto con día, semana, y si está iniciado
 */
export function useMethodProgress(methodStartDate?: string | null) {
  const methodDay = useMemo(() => {
    return calculateDaysOnMethod(methodStartDate);
  }, [methodStartDate]);

  const methodWeek = useMemo(() => {
    return calculateCurrentWeek(methodDay);
  }, [methodDay]);

  // Aplicar límite de 90 días (el método se detiene en 90 días = 12 semanas)
  const displayDay = Math.min(methodDay, 90);
  const displayWeek = Math.min(methodWeek, 12);

  const isStarted = methodStartDate != null && methodDay > 0;
  const isCompleted = methodDay >= 90;

  return {
    methodDay,
    methodWeek,
    displayDay,
    displayWeek,
    isStarted,
    isCompleted,
  };
}

