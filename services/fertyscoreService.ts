/**
 * FertyScore calculation service - MVP simplificado
 *
 * - Mantiene 4 pilares: FUNCTION, FOOD, FLORA, FLOW (0–100 cada uno)
 * - FertyScore global = media simple de los 4
 * - Evita doble conteo (tabaco solo en FUNCTION, alcohol solo en FOOD, sueño cantidad solo en FLORA)
 * - Excluye sub-factores sin datos del promedio interno de cada pilar
 */

import { UserProfile, DailyLog } from '../types';
import { calculateBMI } from './dataService';
import { PillarFunction, PillarFood, PillarFlora, PillarFlow } from '../types/pillars';

/**
 * Utilidad para acotar scores entre 0 y 100
 */
function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/**
 * Media simple
 */
function average(values: number[]): number {
  if (!values.length) return NaN;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Media ignorando NaN (para sub-factores opcionales)
 */
function averageDefined(values: number[]): number {
  const valid = values.filter(v => !Number.isNaN(v));
  return average(valid);
}

/**
 * Desviación estándar para BBT u otras métricas
 */
function calculateStandardDeviation(values: number[]): number {
  if (!values.length) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

const DYNAMIC_DAYS = 14;

function takeLastDays(logs: DailyLog[], days: number): DailyLog[] {
  if (!logs.length) return [];
  const sorted = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted.slice(0, days);
}

function takeLastDaysWithBBT(logs: DailyLog[], days: number): DailyLog[] {
  const withBBT = logs.filter(l => typeof l.bbt === 'number' && l.bbt !== null);
  if (!withBBT.length) return [];
  const sorted = [...withBBT].sort((a, b) => (a.date < b.date ? 1 : -1));
  return sorted.slice(0, days);
}

/**
 * Estructura de datos de pilares para el cálculo del FertyScore
 */
export interface FertyPillars {
  function?: PillarFunction | null;
  food?: PillarFood | null;
  flora?: PillarFlora | null;
  flow?: PillarFlow | null;
}

// ============================================================================
// 1. FUNCTION (fisiología / riesgo reproductivo)
// ============================================================================

// IMC: rango ajustado para 17–18,5 según especificación MVP
function calculateBMIScore(bmi: number): number {
  if (Number.isNaN(bmi) || !Number.isFinite(bmi)) return NaN;

  if (bmi >= 20 && bmi <= 25) return 100;
  if (bmi >= 18.5 && bmi < 20) return 85;
  if (bmi > 25 && bmi <= 27.5) return 85;
  if (bmi > 27.5 && bmi <= 30) return 70;
  if (bmi > 30 && bmi <= 35) return 50;
  if (bmi > 35 && bmi <= 40) return 35;
  if (bmi > 40) return 25;

  if (bmi < 17) return 40;
  if (bmi >= 17 && bmi < 18.5) return 70;

  // fallback para casos raros
  return 55;
}

function calculateAgeScore(age: number): number {
  if (!age || age <= 0) return NaN;
  if (age <= 30) return 100;
  if (age <= 34) return 90;
  if (age <= 37) return 80;
  if (age <= 40) return 65;
  return 50;
}

// Normaliza texto para comparar diagnósticos: minúsculas, sin tildes
function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function calculateDiagnosesScore(
  user: UserProfile,
  pillar?: PillarFunction | null
): number {
  const riskList = [
    'SOP',
    'PCOS',
    'Endometriosis',
    'Ovarios Poliquisticos', // sin tilde, lo normalizamos
    'insuficiencia ovarica',
  ];

  const allDiagRaw = [
    ...(Array.isArray(user.diagnoses) ? user.diagnoses : []),
    ...(pillar?.diagnoses ?? []),
  ];

  const allDiagNormalized = allDiagRaw.map(d => normalizeText(d));
  const riskListNormalized = riskList.map(r => normalizeText(r));

  const hasRisk = riskListNormalized.some(risk =>
    allDiagNormalized.some(d =>
      d.includes(risk) &&
      !d.includes(`no ${risk}`) &&
      !d.includes(`sin ${risk}`)
    )
  );

  return hasRisk ? 60 : 100;
}

function calculateSmokingScore(smokerText?: string | null): number {
  const text = (smokerText ?? '').toLowerCase().trim();

  // Sin respuesta asumimos "no fuma" para MVP
  if (!text) return 100;

  // No fuma
  if (text.includes('no') || text.includes('nunca')) {
    return 100;
  }

  // Exfumadora
  if (
    text.includes('ex') ||
    text.includes('dej') ||      // "dejé de fumar"
    text.includes('deje') ||     // sin tilde
    text.includes('dejo de fumar')
  ) {
    return 85;
  }

  // Fumadora diaria
  if (
    text.includes('diario') ||
    text.includes('a diario') ||
    text.includes('cada dia') ||
    text.includes('cada día')
  ) {
    return 20;
  }

  // Fumadora ocasional / social
  if (
    text.includes('ocasional') ||
    text.includes('social') ||
    text.includes('finde') ||
    text.includes('fin de semana')
  ) {
    return 65;
  }

  // Cualquier otro texto ambiguo (ej. "fumo poco")
  return 70;
}

const FUNCTION_WEIGHTS = {
  bmi: 0.30,
  age: 0.30,
  diagnoses: 0.20,
  smoking: 0.20,
} as const;

function calculateFunctionScore(user: UserProfile, pillar?: PillarFunction | null): number {
  const bmiVal = calculateBMI(user.weight, user.height);
  const scores = {
    bmi: calculateBMIScore(bmiVal),
    age: calculateAgeScore(user.age),
    diagnoses: calculateDiagnosesScore(user, pillar),
    smoking: calculateSmokingScore(user.smoker),
  };

  const components = [
    ['bmi', scores.bmi],
    ['age', scores.age],
    ['diagnoses', scores.diagnoses],
    ['smoking', scores.smoking],
  ] as [keyof typeof FUNCTION_WEIGHTS, number][];

  const valid = components.filter(([, v]) => !Number.isNaN(v));
  if (!valid.length) return NaN;

  const weighted = valid.reduce(
    (acc, [key, value]) => acc + value * FUNCTION_WEIGHTS[key],
    0,
  );
  const totalWeight = valid.reduce(
    (acc, [key]) => acc + FUNCTION_WEIGHTS[key],
    0,
  );

  let baseScore = clampScore(weighted / totalWeight);

  // --- CAP PARA FUMADORA DIARIA ---
  // Si el score de tabaco es muy bajo (fumadora diaria),
  // FUNCTION no puede ser > 70.
  if (!Number.isNaN(scores.smoking) && scores.smoking <= 20) {
    baseScore = Math.min(baseScore, 70);
  }
  // -------------------------------

  return baseScore;
}

// ============================================================================
// 2. FOOD (alimentación / alcohol / riesgo metabólico)
// ============================================================================

function calculateVegDiversityScore(diversity?: number | null): number {
  if (diversity == null) return NaN;
  if (diversity >= 5) return 100;
  if (diversity >= 3) return 80;
  if (diversity >= 1) return 60;
  return 40;
}

function calculateFiberScore(fiber?: number | null): number {
  if (fiber == null) return NaN;
  if (fiber >= 25 && fiber <= 35) return 100;
  if (fiber >= 18) return 85;
  if (fiber >= 12) return 70;
  return 50;
}

function calculateUltraProcessedScore(level?: string | null): number {
  const text = (level ?? '').toLowerCase();
  if (!text) return NaN;
  if (text.includes('nunca')) return 100;
  if (text.includes('1-2')) return 75;
  if (text.includes('3-4')) return 55;
  if (text.includes('5+')) return 30;
  return 60;
}

function calculateProteinScore(protein?: number | null): number {
  if (protein == null) return NaN;
  if (protein >= 70 && protein <= 120) return 100;
  if (protein >= 50) return 85;
  if (protein >= 40) return 70;
  return 55;
}

function calculateDietQualityScore(food: PillarFood): number {
  return clampScore(averageDefined([
    calculateFiberScore(food.daily_fiber),
    calculateVegDiversityScore(food.vegetable_diversity),
    calculateUltraProcessedScore(food.ultraprocessed),
    calculateProteinScore(food.daily_protein),
  ]));
}

function calculateWaistScore(waist?: number | null): number {
  if (waist == null) return NaN;
  if (waist <= 80) return 100;
  if (waist <= 88) return 80;
  return 55;
}

function calculateExerciseScore(value?: string | null): number {
  if (!value) return NaN;

  const text = value.toLowerCase();

  if (text === '3-4' || text === '5+') return 100;
  if (text === '1-2') return 75;
  if (text === 'no hago') return 35;

  // fallback por si en el futuro se añaden otras opciones
  return 50;
}

function calculateMetabolicScore(food: PillarFood): number {
  return clampScore(averageDefined([
    calculateWaistScore(food.waist_circumference),
    calculateExerciseScore(food.weekly_exercise),
  ]));
}

function calculateAlcoholBaselineScore(value?: string | null): number {
  // Sin respuesta → sin dato, no regalamos 100
  if (!value) return NaN;

  const text = value.toLowerCase();

  if (text === 'no tomo') return 100;
  if (text === 'ocasional') return 75;
  if (text === 'frecuente' || text === 'diario') return 30;

  // Por si en el futuro se añaden otras opciones
  return 60;
}

const FOOD_BASELINE_WEIGHTS = {
  diet: 0.4,
  metabolic: 0.3,
  alcohol: 0.3,
} as const;

function calculateFoodBaseline(food?: PillarFood | null): number {
  if (!food) return NaN;

  const diet = calculateDietQualityScore(food);
  const metabolic = calculateMetabolicScore(food);
  const alcohol = calculateAlcoholBaselineScore(food.alcohol_consumption);

  const components = { diet, metabolic, alcohol };
  const valid = Object.entries(components).filter(
    ([, v]) => !Number.isNaN(v),
  ) as [keyof typeof FOOD_BASELINE_WEIGHTS, number][];

  if (!valid.length) return NaN;

  const weighted = valid.reduce(
    (acc, [key, value]) => acc + value * FOOD_BASELINE_WEIGHTS[key],
    0,
  );

  const totalWeight = valid.reduce(
    (acc, [key]) => acc + FOOD_BASELINE_WEIGHTS[key],
    0,
  );

  return clampScore(weighted / totalWeight);
}

const FOOD_DYNAMIC_WEIGHTS = {
  veg: 0.5,
  alcohol: 0.3,
  water: 0.2,
} as const;

function averageField(logs: DailyLog[], field: keyof DailyLog): number {
  const values = logs
    .map(l => l[field])
    .filter(v => v !== null && v !== undefined) as number[];

  if (!values.length) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function calculateVegDynamicScore(avgVeg: number): number {
  if (Number.isNaN(avgVeg)) return NaN;
  if (avgVeg >= 5) return 100;
  if (avgVeg >= 3) return 75;
  if (avgVeg >= 1) return 60;
  return 40;
}

function calculateAlcoholDynamicScore(daysAlcohol: number): number {
  if (daysAlcohol === 0) return 100;
  if (daysAlcohol <= 2) return 70;
  if (daysAlcohol <= 4) return 50;
  return 25;
}

function calculateWaterDynamicScore(avgWater: number): number {
  if (Number.isNaN(avgWater)) return NaN;
  if (avgWater >= 6 && avgWater <= 10) return 100;
  if (avgWater >= 4) return 80;
  return 55;
}

function calculateFoodDynamic(logs: DailyLog[]): number {
  const recent = takeLastDays(logs, DYNAMIC_DAYS);
  if (!recent.length) return NaN;

  const avgVeg = averageField(recent, 'veggieServings');
  const avgWater = averageField(recent, 'waterGlasses');
  const daysAlcohol = recent.filter(l => l.alcohol === true).length;

  const components = {
    veg: calculateVegDynamicScore(avgVeg),
    alcohol: calculateAlcoholDynamicScore(daysAlcohol),
    water: calculateWaterDynamicScore(avgWater),
  };

  const validEntries = Object.entries(components).filter(
    ([, v]) => !Number.isNaN(v),
  ) as [keyof typeof FOOD_DYNAMIC_WEIGHTS, number][];

  if (!validEntries.length) return NaN;

  const weighted = validEntries.reduce((acc, [key, value]) => {
    const weight = FOOD_DYNAMIC_WEIGHTS[key];
    return acc + value * weight;
  }, 0);

  const totalWeight = validEntries.reduce(
    (acc, [key]) => acc + FOOD_DYNAMIC_WEIGHTS[key],
    0,
  );

  return clampScore(weighted / totalWeight);
}

function calculateFoodScore(food?: PillarFood | null, logs: DailyLog[] = []): number {
  const baseline = calculateFoodBaseline(food);
  const dynamic = calculateFoodDynamic(logs);

  if (Number.isNaN(dynamic) && !Number.isNaN(baseline)) return baseline;
  if (Number.isNaN(baseline) && !Number.isNaN(dynamic)) return dynamic;
  if (Number.isNaN(baseline) && Number.isNaN(dynamic)) return NaN;

  return clampScore(0.6 * baseline + 0.4 * dynamic);
}

// ============================================================================
// 3. FLORA (microbiota + sueño)
// ============================================================================

function normalizeYesNo(value: any): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;

  const t = String(value).toLowerCase().trim();
  return ['si', 'sí', 'yes', 'true'].includes(t);
}

function yesNoScore(value: any, goodWhenYes: boolean): number {
  const v = normalizeYesNo(value);
  if (v === null) return NaN;

  return goodWhenYes
    ? (v ? 90 : 60)
    : (v ? 60 : 100);
}

function calculateBristolScore(value?: number | null): number {
  if (value == null) return NaN;
  if (value === 3 || value === 4) return 100;
  if (value === 2 || value === 5) return 70;
  return 50;
}

function calculateMicrobiotaRiskScore(flora: PillarFlora): number {
  const scores = [
    yesNoScore(flora.antibiotics_last_12_months, false),
    yesNoScore(flora.vaginal_infections, false),
    yesNoScore(flora.altered_vaginal_ph, false),
    calculateBristolScore(flora.bristol_stool_scale),
  ];
  return clampScore(averageDefined(scores));
}

function calculateCareScore(flora: PillarFlora): number {
  const scores = [
    yesNoScore(flora.previous_probiotics, true),
    yesNoScore(flora.microbiome_tests, true),
    yesNoScore(flora.recommended_supplements, true),
  ];
  return clampScore(averageDefined(scores));
}

const FLORA_BASELINE_WEIGHTS = {
  risk: 0.7,
  care: 0.3,
} as const;

function calculateFloraBaseline(flora?: PillarFlora | null): number {
  if (!flora) return NaN;

  const risk = calculateMicrobiotaRiskScore(flora);
  const care = calculateCareScore(flora);

  const validEntries = [
    ['risk', risk],
    ['care', care],
  ].filter(([, v]) => !Number.isNaN(v)) as [keyof typeof FLORA_BASELINE_WEIGHTS, number][];

  // baseline debe tener al menos 2 sub-scores válidos para ser fiable
  if (validEntries.length < 2) return NaN;

  // Si el riesgo es alto (score bajo), el bloque CARE no debe inflar artificialmente el baseline
  if (risk < 60) {
    return clampScore(risk);
  }

  const totalWeight = validEntries.reduce(
    (acc, [key]) => acc + FLORA_BASELINE_WEIGHTS[key],
    0,
  );

  const weighted = validEntries.reduce((acc, [key, value]) => {
    const weight = FLORA_BASELINE_WEIGHTS[key];
    return acc + value * weight;
  }, 0);

  return clampScore(weighted / totalWeight);
}

function calculateSleepScoreFromLogs(logs: DailyLog[]): number {
  const recent = takeLastDays(logs, DYNAMIC_DAYS);
  if (!recent.length) return NaN;

  const sleepValues = recent
    .map(l => l.sleepHours)
    .filter(v => typeof v === 'number') as number[];

  if (!sleepValues.length) return NaN;

  const avgSleep = sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length;

  if (avgSleep >= 7 && avgSleep <= 9) return 100;
  if (avgSleep >= 6) return 80;
  if (avgSleep >= 5) return 60;
  if (avgSleep > 9 && avgSleep <= 10) return 90;
  if (avgSleep > 10) return 75;
  return 40;
}

function calculateFloraScore(flora?: PillarFlora | null, logs: DailyLog[] = []): number {
  const baseline = calculateFloraBaseline(flora);
  const dynamic = calculateSleepScoreFromLogs(logs);

  if (Number.isNaN(dynamic) && !Number.isNaN(baseline)) return baseline;
  if (Number.isNaN(baseline) && !Number.isNaN(dynamic)) return dynamic;
  if (Number.isNaN(baseline) && Number.isNaN(dynamic)) return NaN;

  return clampScore(0.6 * baseline + 0.4 * dynamic);
}

// ============================================================================
// 4. FLOW (estrés, ciclo, estabilidad hormonal/emocional)
// ============================================================================

function likertNegativeToScore(v?: number | null): number {
  if (v == null) return NaN;
  if (v === 1) return 100;
  if (v === 2) return 85;
  if (v === 3) return 70;
  if (v === 4) return 55;
  return 40;
}

function likertPositiveToScore(v?: number | null): number {
  if (v == null) return NaN;
  if (v === 5) return 100;
  if (v === 4) return 85;
  if (v === 3) return 70;
  if (v === 2) return 55;
  return 40;
}

function calculateStressBaselineScore(flow: PillarFlow): number {
  return clampScore(averageDefined([
    likertNegativeToScore(flow.stress_level),
    likertNegativeToScore(flow.mental_load),
    likertNegativeToScore(flow.mental_rumination),
    likertNegativeToScore(flow.frequent_conflicts ? 5 : 1),
    likertNegativeToScore(flow.loneliness),
  ]));
}

function calculateRelationScore(flow: PillarFlow): number {
  return clampScore(averageDefined([
    likertPositiveToScore(flow.libido),
    likertPositiveToScore(flow.emotional_connection_partner),
    likertNegativeToScore(flow.pain_dryness_relationships ? 5 : 1),
    likertNegativeToScore(flow.fertility_anxiety_relationships ? 5 : 1),
  ]));
}

function calculateRecoveryHabitsScore(flow: PillarFlow): number {
  return clampScore(averageDefined([
    likertNegativeToScore(flow.nighttime_screen_use),
    likertPositiveToScore(flow.emotional_support ? 5 : 1),
  ]));
}

const FLOW_BASELINE_WEIGHTS = {
  stress: 0.4,
  relation: 0.3,
  recovery: 0.3,
} as const;

function calculateFlowBaseline(flow?: PillarFlow | null): number {
  if (!flow) return NaN;

  const stress = calculateStressBaselineScore(flow);
  const relation = calculateRelationScore(flow);
  const recovery = calculateRecoveryHabitsScore(flow);

  const components = { stress, relation, recovery };
  const valid = Object.entries(components).filter(
    ([, v]) => !Number.isNaN(v),
  ) as [keyof typeof FLOW_BASELINE_WEIGHTS, number][];

  if (!valid.length) return NaN;

  const weighted = valid.reduce(
    (acc, [key, value]) => acc + value * FLOW_BASELINE_WEIGHTS[key],
    0,
  );
  const totalWeight = valid.reduce(
    (acc, [key]) => acc + FLOW_BASELINE_WEIGHTS[key],
    0,
  );

  return clampScore(weighted / totalWeight);
}

function calculateStressDynamicScore(logs: DailyLog[]): number {
  const recent = takeLastDays(logs, DYNAMIC_DAYS);
  if (!recent.length) return NaN;

  const avgStress = average(recent.map(l => l.stressLevel ?? 0));
  if (Number.isNaN(avgStress) || avgStress <= 0) return NaN;

  return clampScore(((5 - avgStress) / 4) * 100);
}

function calculateCycleRegularityScore(user: UserProfile): number {
  if (user.cycleRegularity === 'Regular') return 100;
  if (user.cycleRegularity === 'Irregular') return 70;
  return 80;
}

function calculateBBTScore(logs: DailyLog[]): number {
  const recent = takeLastDaysWithBBT(logs, DYNAMIC_DAYS);
  if (recent.length < 3) return NaN;

  const values = recent
    .map(l => l.bbt)
    .filter((b): b is number => typeof b === 'number' && !Number.isNaN(b));

  if (values.length < 3) return NaN;

  const sd = calculateStandardDeviation(values);
  if (sd <= 0.15) return 100;
  if (sd >= 0.5) return 45;

  const ratio = (sd - 0.15) / (0.5 - 0.15);
  return clampScore(100 - ratio * (100 - 45));
}

const FLOW_DYNAMIC_WEIGHTS = {
  stress: 0.4,
  cycle: 0.3,
  bbt: 0.3,
} as const;

function calculateFlowDynamic(user: UserProfile, logs: DailyLog[]): number {
  const stress = calculateStressDynamicScore(logs);
  const cycle = calculateCycleRegularityScore(user);
  const bbt = calculateBBTScore(logs);

  const components = { stress, cycle, bbt };
  const valid = Object.entries(components).filter(
    ([, v]) => !Number.isNaN(v),
  ) as [keyof typeof FLOW_DYNAMIC_WEIGHTS, number][];

  if (!valid.length) return NaN;

  const weighted = valid.reduce(
    (acc, [key, value]) => acc + value * FLOW_DYNAMIC_WEIGHTS[key],
    0,
  );
  const totalWeight = valid.reduce(
    (acc, [key]) => acc + FLOW_DYNAMIC_WEIGHTS[key],
    0,
  );

  return clampScore(weighted / totalWeight);
}

function calculateFlowScore(user: UserProfile, flow?: PillarFlow | null, logs: DailyLog[] = []): number {
  const baseline = calculateFlowBaseline(flow);
  const dynamic = calculateFlowDynamic(user, logs);

  if (Number.isNaN(dynamic) && !Number.isNaN(baseline)) return baseline;
  if (Number.isNaN(baseline) && !Number.isNaN(dynamic)) return dynamic;
  if (Number.isNaN(baseline) && Number.isNaN(dynamic)) return NaN;

  return clampScore(0.6 * baseline + 0.4 * dynamic);
}

// ============================================================================
// 5. FertyScore global
// ============================================================================

export const calculateFertyScore = (
  user: UserProfile,
  logs: DailyLog[],
  pillars: FertyPillars
) => {
  const rawFunction = calculateFunctionScore(user, pillars.function ?? undefined);
  const rawFood = calculateFoodScore(pillars.food ?? undefined, logs);
  const rawFlora = calculateFloraScore(pillars.flora ?? undefined, logs);
  const rawFlow = calculateFlowScore(user, pillars.flow ?? undefined, logs);

  const functionScore = Number.isNaN(rawFunction) ? 0 : rawFunction;
  const foodScore = Number.isNaN(rawFood) ? 0 : rawFood;
  const floraScore = Number.isNaN(rawFlora) ? 0 : rawFlora;
  const flowScore = Number.isNaN(rawFlow) ? 0 : rawFlow;

  const totalRaw = averageDefined([rawFunction, rawFood, rawFlora, rawFlow]);
  const total = Number.isNaN(totalRaw) ? 0 : clampScore(totalRaw);

  return {
    total: Math.round(total),
    function: Math.round(functionScore),
    food: Math.round(foodScore),
    flora: Math.round(floraScore),
    flow: Math.round(flowScore)
  };
};


