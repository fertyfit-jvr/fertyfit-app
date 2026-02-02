/**
 * FertyScore calculation service - MVP simplificado
 *
 * - Mantiene 4 pilares: FUNCTION, FOOD, FLORA, FLOW (0–100 cada uno)
 * - FertyScore global = media simple de los 4
 * - Evita doble conteo (tabaco solo en FUNCTION, alcohol solo en FOOD, sueño cantidad solo en FLORA)
 * - Excluye sub-factores sin datos del promedio interno de cada pilar
 */

import { UserProfile, DailyLog } from '../types';
import { supabase } from './supabase';
import { logger } from '../lib/logger';
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

// ⭐ NUEVAS FUNCIONES DE SCORING BASADAS EN PUNTOS (0-10 puntos → 0-100 score)
function getEatingPatternPoints(pattern?: string): number {
  if (!pattern) return NaN;
  if (pattern.includes('a) Consumo frecuente')) return 0;
  if (pattern.includes('b) Una mezcla')) return 4;
  if (pattern.includes('c) Mayor parte')) return 7;
  if (pattern.includes('d) Alimentos frescos')) return 10;
  return NaN;
}

function getFishFrequencyPoints(frequency?: number): number {
  if (frequency == null) return NaN;
  // 0 veces = 1 pt, 1 vez = 5 pt, 2+ = 10 pt
  if (frequency === 0) return 1;
  if (frequency === 1) return 5;
  if (frequency >= 2) return 10;
  return NaN;
}

function getVegetableServingsPoints(servings?: number): number {
  if (servings == null) return NaN;
  // 0 raciones = 1 pt, 5+ = 10 pt (escalado lineal)
  if (servings === 0) return 1;
  if (servings >= 5) return 10;
  // Interpolación lineal: 1-4 raciones
  // 1→3.25, 2→5.5, 3→7.75, 4→10
  return Math.round((1 + (servings * 2.25)) * 10) / 10;
}

function getFatTypePoints(fatType?: string): number {
  if (!fatType) return NaN;
  if (fatType.includes('a) Mantequilla')) return 0;
  if (fatType.includes('b) Una mezcla')) return 4;
  if (fatType.includes('c) Principalmente aceite')) return 8;
  if (fatType.includes('d) Casi exclusivamente AOVE')) return 10;
  return NaN;
}

function getFertilitySupplementsPoints(supplements?: string): number {
  if (!supplements) return NaN;
  if (supplements.includes('a) No tomo ningún suplemento')) return 1;
  if (supplements.includes('b) Tomo solo ácido fólico sintético')) return 4;
  if (supplements.includes('c) Tomo un multivitamínico')) return 7;
  if (supplements.includes('d) Protocolo personalizado')) return 10;
  return NaN;
}

function getSugaryDrinksPoints(frequency?: number): number {
  if (frequency == null) return NaN;
  // Diariamente (7 veces/semana) = 0 pt, Muy raramente o nunca (0 veces) = 10 pt
  // Escalado inverso: más frecuencia = menos puntos
  if (frequency === 0) return 10;
  if (frequency === 1) return 8;
  if (frequency === 2) return 6;
  if (frequency === 3) return 4;
  if (frequency === 4) return 3;
  if (frequency === 5) return 2;
  if (frequency === 6) return 1;
  if (frequency >= 7) return 0;
  return NaN;
}

function getAntioxidantsPoints(antioxidants?: string): number {
  if (!antioxidants) return NaN;
  if (antioxidants.includes('a) Raramente')) return 2;
  if (antioxidants.includes('b) Algunas veces')) return 5;
  if (antioxidants.includes('c) Casi todos los días')) return 8;
  if (antioxidants.includes('d) Diariamente')) return 10;
  return NaN;
}

function getCarbSourcePoints(carbSource?: string): number {
  if (!carbSource) return NaN;
  if (carbSource.includes('a) Pan blanco')) return 1;
  if (carbSource.includes('b) Una mezcla')) return 4;
  if (carbSource.includes('c) Principalmente integrales')) return 7;
  if (carbSource.includes('d) Carbohidratos complejos')) return 10;
  return NaN;
}

// Convertir puntos (0-10) a score (0-100)
function pointsToScore(points: number): number {
  if (Number.isNaN(points)) return NaN;
  return clampScore(points * 10); // 0 pt → 0 score, 10 pt → 100 score
}

function calculateNewFoodBaseline(food?: PillarFood | null): number {
  if (!food) return NaN;

  // Verificar si tiene datos nuevos (sistema de puntos)
  const hasNewData = food.eating_pattern ||
    food.fish_frequency != null ||
    food.vegetable_servings != null ||
    food.fat_type ||
    food.fertility_supplements ||
    food.sugary_drinks_frequency != null ||
    food.antioxidants ||
    food.carb_source;

  if (hasNewData) {
    // Usar nuevo sistema de puntos
    const scores = [
      pointsToScore(getEatingPatternPoints(food.eating_pattern)),
      pointsToScore(getFishFrequencyPoints(food.fish_frequency)),
      pointsToScore(getVegetableServingsPoints(food.vegetable_servings)),
      pointsToScore(getFatTypePoints(food.fat_type)),
      pointsToScore(getFertilitySupplementsPoints(food.fertility_supplements)),
      pointsToScore(getSugaryDrinksPoints(food.sugary_drinks_frequency)),
      pointsToScore(getAntioxidantsPoints(food.antioxidants)),
      pointsToScore(getCarbSourcePoints(food.carb_source)),
    ];

    const valid = scores.filter(s => !Number.isNaN(s));
    if (valid.length === 0) return NaN;

    // Promedio simple de todos los scores válidos
    return clampScore(valid.reduce((a, b) => a + b, 0) / valid.length);
  }

  // Fallback: usar sistema antiguo si no hay datos nuevos
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

function calculateFoodBaseline(food?: PillarFood | null): number {
  // Usar nuevo sistema si hay datos nuevos, sino usar antiguo
  return calculateNewFoodBaseline(food);
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


// ⭐ NUEVAS FUNCIONES DE SCORING PARA FLORA BASADAS EN PUNTOS (0-10 puntos → 0-100 score)
function getDigestiveHealthPoints(health?: number): number {
  if (health == null) return NaN;
  // Ya viene como 0-10 directamente del slider
  return health;
}

function getVaginalHealthPoints(vaginalHealth?: string): number {
  if (!vaginalHealth) return NaN;
  if (vaginalHealth.includes('a) Síntomas o infecciones recurrentes')) return 1;
  if (vaginalHealth.includes('b) Episodios 1-2 veces')) return 4;
  if (vaginalHealth.includes('c) Muy ocasionalmente')) return 7;
  if (vaginalHealth.includes('d) Excelente')) return 10;
  return NaN;
}

function getAntibioticsLastYearPoints(antibiotics?: string): number {
  if (!antibiotics) return NaN;
  if (antibiotics.includes('a) Sí, múltiples ciclos')) return 2;
  if (antibiotics.includes('b) Sí, un ciclo')) return 5;
  if (antibiotics.includes('c) No, pero sí en los últimos 2-3 años')) return 8;
  if (antibiotics.includes('d) No, no he tomado')) return 10;
  return NaN;
}

function getFermentedFoodsPoints(frequency?: number): number {
  if (frequency == null) return NaN;
  // 0 veces = 1 pt, diario o casi diario (30 veces/mes) = 10 pt
  // Escalado lineal: 0→1, 30→10
  if (frequency === 0) return 1;
  if (frequency >= 30) return 10;
  // Interpolación lineal: 1-29 veces
  // 1→1.31, 10→4, 20→7, 29→9.69
  return Math.round((1 + (frequency * 0.31)) * 10) / 10;
}

function getFoodIntolerancesPoints(intolerances?: string): number {
  if (!intolerances) return NaN;
  if (intolerances.includes('a) Sí, a múltiples alimentos')) return 2;
  if (intolerances.includes('b) Sí, a un alimento')) return 5;
  if (intolerances.includes('c) Sospecho que algo')) return 7;
  if (intolerances.includes('d) No, no tengo ninguna')) return 10;
  return NaN;
}

function calculateNewFloraBaseline(flora?: PillarFlora | null): number {
  if (!flora) return NaN;

  // Verificar si tiene datos nuevos (sistema de puntos)
  const hasNewData = flora.digestive_health != null ||
    flora.vaginal_health ||
    flora.antibiotics_last_year ||
    flora.fermented_foods_frequency != null ||
    flora.food_intolerances;

  if (hasNewData) {
    // Usar nuevo sistema de puntos
    const scores = [
      pointsToScore(getDigestiveHealthPoints(flora.digestive_health)),
      pointsToScore(getVaginalHealthPoints(flora.vaginal_health)),
      pointsToScore(getAntibioticsLastYearPoints(flora.antibiotics_last_year)),
      pointsToScore(getFermentedFoodsPoints(flora.fermented_foods_frequency)),
      pointsToScore(getFoodIntolerancesPoints(flora.food_intolerances)),
    ];

    const valid = scores.filter(s => !Number.isNaN(s));
    if (valid.length === 0) return NaN;

    // Promedio simple de todos los scores válidos
    return clampScore(valid.reduce((a, b) => a + b, 0) / valid.length);
  }

  // Fallback: usar sistema antiguo si no hay datos nuevos
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

  const weighted = validEntries.reduce(
    (acc, [key, value]) => acc + value * FLORA_BASELINE_WEIGHTS[key],
    0,
  );

  const totalWeight = validEntries.reduce(
    (acc, [key]) => acc + FLORA_BASELINE_WEIGHTS[key],
    0,
  );

  return clampScore(weighted / totalWeight);
}

function calculateFloraBaseline(flora?: PillarFlora | null): number {
  // Usar nuevo sistema si hay datos nuevos, sino usar antiguo
  return calculateNewFloraBaseline(flora);
}

// ⭐ FLORA DINÁMICO: Basado en síntomas digestivos (Hinchazón, gases, estreñimiento)
// Empezar con 100, restar 25 por cada síntoma negativo
function calculateDigestiveSymptomsScore(logs: DailyLog[]): number {
  const recent = takeLastDays(logs, DYNAMIC_DAYS);
  if (!recent.length) return NaN;

  const negativeSymptoms = ['hinchazon', 'gases', 'estreñimiento', 'dolor_abdominal', 'diarrea', 'acidez'];

  const dailyScores = recent.map(log => {
    if (!log.symptoms || !Array.isArray(log.symptoms)) return 100;

    // Normalizar síntomas del log a minúsculas
    const logSymptoms = log.symptoms.map(s => s.toLowerCase());

    // Contar cuántos síntomas negativos hay
    const count = negativeSymptoms.reduce((acc, symptom) => {
      // Buscar coincidencia parcial (ej: "hinchazón abdominal" incluye "hinchazon")
      const match = logSymptoms.some(s => s.includes(symptom) || normalizeText(s).includes(symptom));
      return match ? acc + 1 : acc;
    }, 0);

    // 100 - 25 * count, mínimo 0
    return Math.max(0, 100 - (25 * count));
  });

  return average(dailyScores);
}

function calculateFloraScore(flora?: PillarFlora | null, logs: DailyLog[] = []): number {
  const baseline = calculateFloraBaseline(flora);
  const dynamic = calculateDigestiveSymptomsScore(logs); // Changed from Sleep to Digestive Symptoms

  if (Number.isNaN(dynamic) && !Number.isNaN(baseline)) return baseline;
  if (Number.isNaN(baseline) && !Number.isNaN(dynamic)) return dynamic;
  if (Number.isNaN(baseline) && Number.isNaN(dynamic)) return NaN;

  return clampScore(0.6 * baseline + 0.4 * dynamic);
}

// ============================================================================
// 4. FLOW (estrés, ciclo, estabilidad hormonal/emocional)
// ============================================================================

// Helpers Likert estandarizados según especificación del equipo
function likertNegative(v?: number | null): number {
  if (v == null) return NaN;
  // índice: 0,1,2,3,4,5  →  null,100,85,70,55,40
  const table = [null, 100, 85, 70, 55, 40] as const;
  const mapped = table[v as number];
  return typeof mapped === 'number' ? mapped : NaN;
}

function likertPositive(v?: number | null): number {
  if (v == null) return NaN;
  // índice: 0,1,2,3,4,5  →  null,40,55,70,85,100
  const table = [null, 40, 55, 70, 85, 100] as const;
  const mapped = table[v as number];
  return typeof mapped === 'number' ? mapped : NaN;
}

// Campos que pertenecen al baseline FLOW (según especificación)
const NEGATIVE_FIELDS = [
  'stress_level',
  'mental_load',
  'mental_rumination',
  'nighttime_screen_use',
  'loneliness',
  'frequent_conflicts',
  'fertility_anxiety_relationships',
  'pain_dryness_relationships',
] as const;

const POSITIVE_FIELDS = [
  'libido',
  'emotional_connection_partner',
  'emotional_support',
] as const;

// Baseline FLOW: media simple de todos los sub-scores válidos (mínimo 3)
// ⭐ NUEVAS FUNCIONES DE SCORING PARA FLOW BASADAS EN PUNTOS (0-10 puntos → 0-100 score)
function getStressLevelPoints(stress?: number): number {
  if (stress == null) return NaN;
  // El estrés es inverso: más alto = peor
  // 0 (muy alto/abrumada) = 0 pt, 10 (bajo/tranquila) = 10 pt
  // Ya viene como 0-10 del slider, pero invertido conceptualmente
  // Si el slider va de 0 (muy alto) a 10 (bajo), entonces el valor directo es correcto
  return stress;
}

function getSleepHoursPoints(hours?: number): number {
  if (hours == null) return NaN;
  // <6 horas = 1 pt, 7-8.5 horas = 10 pt
  if (hours < 6) return 1;
  if (hours >= 7 && hours <= 8.5) return 10;
  // Interpolación: 6-7 y 8.5-10
  if (hours >= 6 && hours < 7) {
    // 6→1, 7→10 (interpolación lineal)
    return 1 + ((hours - 6) * 9);
  }
  if (hours > 8.5 && hours <= 10) {
    // 8.5→10, 10→8 (ligera penalización por exceso)
    return 10 - ((hours - 8.5) * 1.33);
  }
  // >10 horas = penalización mayor
  if (hours > 10) return 5;
  return NaN;
}

function getRelaxationFrequencyPoints(frequency?: number): number {
  if (frequency == null) return NaN;
  // Nunca (0 veces) = 1 pt, Práctica diaria o casi diaria (7 veces/semana) = 10 pt
  if (frequency === 0) return 1;
  if (frequency >= 7) return 10;
  // Interpolación lineal: 1-6 veces
  // 1→2.43, 2→3.86, 3→5.29, 4→6.72, 5→8.15, 6→9.58
  return Math.round((1 + (frequency * 1.43)) * 10) / 10;
}

function getExerciseTypePoints(exerciseType?: string): number {
  if (!exerciseType) return NaN;
  if (exerciseType.includes('a) No hago o hago ejercicio de muy alta intensidad')) return 2;
  if (exerciseType.includes('b) Hago ejercicio de forma irregular')) return 5;
  if (exerciseType.includes('c) Realizo ejercicio moderado 2-3 veces')) return 8;
  if (exerciseType.includes('d) Combino moderado con prácticas restaurativas')) return 10;
  return NaN;
}

function getMorningSunlightPoints(sunlight?: string): number {
  if (!sunlight) return NaN;
  if (sunlight.includes('a) No, casi nunca salgo')) return 1;
  if (sunlight.includes('b) A veces, durante el fin de semana')) return 4;
  if (sunlight.includes('c) La mayoría de los días')) return 7;
  if (sunlight.includes('d) Sí, intento estar al aire libre')) return 10;
  return NaN;
}

function getEndocrineDisruptorsPoints(disruptors?: string): number {
  if (!disruptors) return NaN;
  if (disruptors.includes('a) No, no he hecho ningún cambio')) return 1;
  if (disruptors.includes('b) He hecho algunos cambios pequeños')) return 4;
  if (disruptors.includes('c) He cambiado varios productos')) return 7;
  if (disruptors.includes('d) He realizado una auditoría completa')) return 10;
  return NaN;
}

function getBedtimeRoutinePoints(routine?: string): number {
  if (!routine) return NaN;
  if (routine.includes('a) Uso el móvil o veo pantallas hasta el último minuto')) return 1;
  if (routine.includes('b) Intento apagar las pantallas un poco antes')) return 4;
  if (routine.includes('c) Tengo una rutina de relajación')) return 7;
  if (routine.includes('d) Apago las pantallas al menos 1 hora antes')) return 10;
  return NaN;
}

function getEmotionalStatePoints(emotionalState?: number): number {
  if (emotionalState == null) return NaN;
  // Ya viene como 1-10 directamente del slider
  // 1 (Consumida por ansiedad) = 1 pt, 10 (Empoderada) = 10 pt
  return emotionalState;
}

function calculateNewFlowBaseline(flow?: PillarFlow | null): number {
  if (!flow) return NaN;

  // Verificar si tiene datos nuevos (sistema de puntos)
  const hasNewData = flow.stress_level != null ||
    flow.sleep_hours != null ||
    flow.relaxation_frequency != null ||
    flow.exercise_type ||
    flow.morning_sunlight ||
    flow.endocrine_disruptors ||
    flow.bedtime_routine ||
    flow.emotional_state != null;

  if (hasNewData) {
    // Usar nuevo sistema de puntos
    const scores = [
      pointsToScore(getStressLevelPoints(flow.stress_level)),
      pointsToScore(getSleepHoursPoints(flow.sleep_hours)),
      pointsToScore(getRelaxationFrequencyPoints(flow.relaxation_frequency)),
      pointsToScore(getExerciseTypePoints(flow.exercise_type)),
      pointsToScore(getMorningSunlightPoints(flow.morning_sunlight)),
      pointsToScore(getEndocrineDisruptorsPoints(flow.endocrine_disruptors)),
      pointsToScore(getBedtimeRoutinePoints(flow.bedtime_routine)),
      pointsToScore(getEmotionalStatePoints(flow.emotional_state)),
    ];

    const valid = scores.filter(s => !Number.isNaN(s));
    if (valid.length === 0) return NaN;

    // Promedio simple de todos los scores válidos
    return clampScore(valid.reduce((a, b) => a + b, 0) / valid.length);
  }

  // Fallback: usar sistema antiguo si no hay datos nuevos
  const scores: number[] = [];

  // Campos "negativos" (más alto = peor)
  NEGATIVE_FIELDS.forEach(field => {
    const raw = (flow as any)[field];
    // booleans se mapean a 1/5 según el doc
    if (typeof raw === 'boolean') {
      const likert = raw ? 5 : 1;
      scores.push(likertNegative(likert));
    } else {
      scores.push(likertNegative(raw));
    }
  });

  // Campos "positivos" (más alto = mejor)
  POSITIVE_FIELDS.forEach(field => {
    const raw = (flow as any)[field];
    if (typeof raw === 'boolean') {
      const likert = raw ? 5 : 1;
      scores.push(likertPositive(likert));
    } else {
      scores.push(likertPositive(raw));
    }
  });

  const valid = scores.filter(s => !Number.isNaN(s));

  // Mínimo 3 sub-scores válidos para considerar FLOW baseline fiable
  if (valid.length < 3) return NaN;

  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return clampScore(avg);
}

function calculateFlowBaseline(flow?: PillarFlow | null): number {
  // Usar nuevo sistema si hay datos nuevos, sino usar antiguo
  return calculateNewFlowBaseline(flow);
}

// ⭐ FLOW DINÁMICO: Sueño (50%) + Estrés Diario (50%)
function calculateFlowSleepDynamic(logs: DailyLog[]): number {
  const recent = takeLastDays(logs, DYNAMIC_DAYS);
  if (!recent.length) return NaN;

  const sleepValues = recent
    .map(l => l.sleepHours)
    .filter(v => typeof v === 'number') as number[];

  if (!sleepValues.length) return NaN;

  const avgSleep = sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length;

  // 7-9h = 100, 6h = 80, <5h = 60
  if (avgSleep >= 7 && avgSleep <= 9) return 100;
  if (avgSleep >= 6) return 80;
  if (avgSleep < 6) return 60; // <5h covers everything below 6 essentially based on spec logic flow

  return 60; // Fallback
}

// Estrés Diario: 1-2 = 100, 3 = 70, 4-5 = 30
function calculateFlowStressDynamic(logs: DailyLog[]): number {
  const recent = takeLastDays(logs, DYNAMIC_DAYS);
  if (!recent.length) return NaN;

  const stressValues = recent
    .map(l => l.stressLevel)
    .filter(v => typeof v === 'number') as number[];

  if (!stressValues.length) return NaN;

  const avgStress = stressValues.reduce((a, b) => a + b, 0) / stressValues.length;

  if (avgStress <= 2) return 100;
  if (avgStress <= 3) return 70;
  return 30; // 4-5
}

const FLOW_DYNAMIC_WEIGHTS = {
  stress: 0.5,
  sleep: 0.5,
} as const;

function calculateFlowDynamic(user: UserProfile, logs: DailyLog[]): number {
  const stress = calculateFlowStressDynamic(logs);
  const sleep = calculateFlowSleepDynamic(logs);

  const components = { stress, sleep };
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

/**
 * Persist the score in the database
 */
async function saveFertyScoreToDB(
  userId: string,
  scores: { total: number; function: number; food: number; flora: number; flow: number },
  trigger: string
) {
  try {
    const { error } = await supabase.from('ferty_scores').insert({
      user_id: userId,
      global_score: scores.total,
      function_score: scores.function,
      food_score: scores.food,
      flora_score: scores.flora,
      flow_score: scores.flow,
      calculation_trigger: trigger
    });

    if (error) {
      logger.error('Error saving ferty_score:', error);
    } else {
      logger.log('✅ FertyScore saved to history:', scores);
    }
  } catch (err) {
    logger.error('Exception saving ferty_score:', err);
  }
}

/**
 * Main entry point to calculate and save score
 * Checks if it's necessary to save (modulo 3 logs)
 */
export async function calculateAndSaveScore(
  userId: string,
  user: UserProfile,
  logs: DailyLog[],
  pillars: FertyPillars,
  trigger: 'profile_update' | 'daily_log' | 'manual_recalc'
) {
  // Calculate
  const scores = calculateFertyScore(user, logs, pillars);

  // Check condition to save
  let shouldSave = false;

  if (trigger === 'profile_update' || trigger === 'manual_recalc') {
    shouldSave = true;
  } else if (trigger === 'daily_log') {
    // Only save every 3 logs
    // We count how many logs user has. 
    // logs.length is the total count.
    if (logs.length > 0 && logs.length % 3 === 0) {
      shouldSave = true;
    }
  }

  if (shouldSave) {
    await saveFertyScoreToDB(userId, scores, trigger);
  }

  return scores;
}


