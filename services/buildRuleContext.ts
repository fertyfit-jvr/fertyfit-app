/**
 * Helper para construir RuleContext completo
 * Centraliza la lógica de construcción del contexto para el RuleEngine
 */

import { UserProfile, DailyLog, CourseModule } from '../types';
import { RuleContext } from './RuleEngine';
import { calcularVentanaFertil } from './CycleCalculations';
import { getCycleDay } from '../hooks/useCycleDay';
import {
    calculateDaysSinceLastDailyLog,
} from './ruleContextHelpers';

/**
 * Construye un RuleContext optimizado para el MVP
 * Solo calcula lo necesario para las 5 reglas MVP
 */
export async function buildRuleContext(
    user: UserProfile,
    logs: DailyLog[],
    courseModules: CourseModule[] = [] // Mantener parámetro para compatibilidad, pero no se usa en MVP
): Promise<RuleContext> {
    // ✅ CALCULAR: Lo que SÍ usan las reglas MVP
    // Ciclo
    const currentCycleDay = user.lastPeriodDate && user.cycleLength
        ? getCycleDay(user.lastPeriodDate, user.cycleLength)
        : undefined;

    const cycleLength = user.cycleLength;
    const ventanaFertil = cycleLength ? calcularVentanaFertil(cycleLength) : undefined;

    // Adherencia (solo daysSinceLastDailyLog para ENG-1)
    const daysSinceLastDailyLog = calculateDaysSinceLastDailyLog(logs);

    // ❌ NO CALCULAR: Lo que NO se usa en reglas MVP
    // Estas propiedades quedan como undefined (opcionales en la interfaz RuleContext)
    // Esto es seguro porque las reglas MVP no las usan

    return {
        user,
        currentCycleDay,
        cycleLength,
        ventanaFertil,
        daysSinceLastDailyLog,
        // Propiedades no usadas en MVP (opcionales, seguras de dejar como undefined)
        dailyLogStreak: undefined,
        last7DaysStats: undefined,
        formsStatus: undefined,
        learnProgress: undefined,
        lastWeeklySummaryAt: undefined,
        lastMonthlySummaryAt: undefined,
        previousWeight: undefined,
    };
}

