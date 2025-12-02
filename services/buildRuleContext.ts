/**
 * Helper para construir RuleContext completo
 * Centraliza la lógica de construcción del contexto para el RuleEngine
 */

import { UserProfile, DailyLog, CourseModule } from '../types';
import { RuleContext } from './RuleEngine';
import { calcularVentanaFertil } from './CycleCalculations';
import { getCycleDay } from '../hooks/useCycleDay';
import {
    calculateFormsStatus,
    calculateDaysSinceLastDailyLog,
    calculateDailyLogStreak,
    calculateLast7DaysStats,
    calculateLearnProgress,
    getLastSummaryDates
} from './ruleContextHelpers';

/**
 * Construye un RuleContext completo para el RuleEngine
 */
export async function buildRuleContext(
    user: UserProfile,
    logs: DailyLog[],
    courseModules: CourseModule[] = []
): Promise<RuleContext> {
    // Calcular ciclo
    const currentCycleDay = user.lastPeriodDate && user.cycleLength
        ? getCycleDay(user.lastPeriodDate, user.cycleLength)
        : undefined;

    const cycleLength = user.cycleLength;
    const ventanaFertil = cycleLength ? calcularVentanaFertil(cycleLength) : undefined;

    // Calcular adherencia
    const daysSinceLastDailyLog = calculateDaysSinceLastDailyLog(logs);
    const dailyLogStreak = calculateDailyLogStreak(logs);
    const last7DaysStats = calculateLast7DaysStats(logs);

    // Calcular formularios
    const formsStatus = user.id ? await calculateFormsStatus(user.id) : undefined;

    // Calcular aprendizaje
    const learnProgress = user.id && courseModules.length > 0
        ? await calculateLearnProgress(user.id, courseModules)
        : undefined;

    // Obtener fechas de resúmenes
    const summaryDates = user.id ? await getLastSummaryDates(user.id) : {};

    return {
        user,
        currentCycleDay,
        cycleLength,
        ventanaFertil,
        daysSinceLastDailyLog,
        dailyLogStreak,
        last7DaysStats,
        formsStatus,
        learnProgress,
        lastWeeklySummaryAt: summaryDates.lastWeeklySummaryAt,
        lastMonthlySummaryAt: summaryDates.lastMonthlySummaryAt
    };
}

