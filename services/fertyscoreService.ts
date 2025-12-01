/**
 * FertyScore calculation service
 * Versión robusta:
 * - Usa TODOS los datos de formularios/pilares (FUNCTION, FOOD, FLORA, FLOW)
 * - Combina baseline (pilares) + dinámica (registros diarios)
 * - Devuelve un score 0–100 por pilar y total
 */

import { UserProfile, DailyLog } from '../types';
import { calculateAverages, calculateBMI } from './dataService';
import { PillarFunction, PillarFood, PillarFlora, PillarFlow } from '../types/pillars';

/**
 * Utilidad para acotar scores entre 0 y 100
 */
function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
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

/**
 * Estructura de datos de pilares para el cálculo del FertyScore
 */
export interface FertyPillars {
  function?: PillarFunction | null;
  food?: PillarFood | null;
  flora?: PillarFlora | null;
  flow?: PillarFlow | null;
}

/**
 * ============================
 * PILAR FUNCTION (clínico/físico)
 * ============================
 */
function calculateFunctionBaseline(user: UserProfile, pillar?: PillarFunction | null): number {
  // -------------------------
  // 1) IMC (perfil / F0) - Penalización estricta para obesidad
  // -------------------------
  const bmi = calculateBMI(user.weight, user.height);
  const bmiVal = parseFloat(bmi);
  let bmiScore = 60;
  if (!Number.isNaN(bmiVal)) {
    if (bmiVal >= 20 && bmiVal <= 25) {
      bmiScore = 100; // Ideal
    } else if ((bmiVal >= 18.5 && bmiVal < 20) || (bmiVal > 25 && bmiVal <= 27.5)) {
      bmiScore = 85; // Aceptable
    } else if ((bmiVal >= 17 && bmiVal < 18.5) || (bmiVal > 27.5 && bmiVal <= 30)) {
      bmiScore = 70; // Sobrepeso moderado / bajo peso ligero
    } else if (bmiVal > 30 && bmiVal <= 35) {
      bmiScore = 50; // Obesidad grado I
    } else if (bmiVal > 35 && bmiVal <= 40) {
      bmiScore = 35; // Obesidad grado II
    } else if (bmiVal > 40) {
      bmiScore = 25; // Obesidad extrema (grado III)
    } else if (bmiVal < 17) {
      bmiScore = 40; // Bajo peso severo
    } else {
      bmiScore = 55;
    }
  }

  // -------------------------
  // 2) Edad reproductiva
  // -------------------------
  let ageScore = 80;
  if (user.age <= 30) {
    ageScore = 100;
  } else if (user.age <= 34) {
    ageScore = 90;
  } else if (user.age <= 37) {
    ageScore = 80;
  } else if (user.age <= 40) {
    ageScore = 65;
  } else {
    ageScore = 50;
  }

  // -------------------------
  // 3) Diagnósticos de riesgo (perfil + pilar)
  // -------------------------
  const riskyDiagnoses = ['SOP', 'PCOS', 'Endometriosis', 'Ovarios Poliquísticos'];
  const allDiagnoses: string[] = [
    ...(Array.isArray(user.diagnoses) ? user.diagnoses : []),
    ...(pillar?.diagnoses ?? []),
  ];
  const hasRiskDiagnosis =
    allDiagnoses.length > 0 &&
    allDiagnoses.some(d => riskyDiagnoses.some(rd => d.toLowerCase().includes(rd.toLowerCase())));
  const diagnosesScore = hasRiskDiagnosis ? 70 : 100;

  // -------------------------
  // 4) Tabaco (perfil o pilar Flow) - Penalización estricta
  // -------------------------
  let smokingScore = 100;
  if (user.smoker) {
    const text = user.smoker.toLowerCase();
    if (text.includes('diario')) smokingScore = 25; // Crítico: -75 puntos
    else if (text.includes('ocasional')) smokingScore = 60; // Alto riesgo: -40 puntos
    else if (text !== 'no') smokingScore = 65; // Riesgo moderado
  }

  // -------------------------
  // 5) Panel hormonal (del pilar)
  // -------------------------
  let hormonalScore = 70; // Valor por defecto reducido (de 85 a 70)
  if (pillar?.hormonal_panel && Object.keys(pillar.hormonal_panel).length > 0) {
    // En el futuro se puede hacer scoring fino por cada parámetro (FSH, LH, estradiol, etc.)
    hormonalScore = 85;
  }

  // -------------------------
  // 6) Panel metabólico (del pilar)
  // -------------------------
  let metabolicScore = 70; // Valor por defecto reducido (de 85 a 70)
  if (pillar?.metabolic_panel && Object.keys(pillar.metabolic_panel).length > 0) {
    // En el futuro se puede hacer scoring fino por cada parámetro (glucosa, insulina, etc.)
    metabolicScore = 85;
  }

  // -------------------------
  // 7) Vitamina D (del pilar)
  // -------------------------
  let vitaminDScore = 70; // Valor por defecto reducido (de 85 a 70)
  if (pillar?.vitamin_d && Object.keys(pillar.vitamin_d).length > 0) {
    // En el futuro se puede hacer scoring basado en niveles de vitamina D
    vitaminDScore = 85;
  }

  // -------------------------
  // 8) Ecografía (del pilar)
  // -------------------------
  let ultrasoundScore = 70; // Valor por defecto reducido (de 85 a 70)
  if (pillar?.ultrasound && Object.keys(pillar.ultrasound).length > 0) {
    // En el futuro se puede hacer scoring basado en resultados de ecografía
    ultrasoundScore = 85;
  }

  // -------------------------
  // 9) HSG (Histerosalpingografía) (del pilar)
  // -------------------------
  let hsgScore = 70; // Valor por defecto reducido (de 85 a 70)
  if (pillar?.hsg && Object.keys(pillar.hsg).length > 0) {
    // En el futuro se puede hacer scoring basado en resultados de HSG
    hsgScore = 85;
  }

  // -------------------------
  // 10) Espermiograma (del pilar)
  // -------------------------
  let spermScore = 70; // Valor por defecto reducido (de 85 a 70)
  if (pillar?.semen_analysis && Object.keys(pillar.semen_analysis).length > 0) {
    // En el futuro se puede hacer scoring basado en resultados del espermiograma
    spermScore = 85;
  }

  // -------------------------
  // Combinar todos los tests (ponderaciones ajustables)
  // -------------------------
  const combinedFromTests =
    hormonalScore * 0.4 +
    metabolicScore * 0.15 +
    vitaminDScore * 0.1 +
    ultrasoundScore * 0.15 +
    hsgScore * 0.1 +
    spermScore * 0.1;

  // Si no hay datos del pilar, asumimos panel neutro (70 en lugar de 85)
  const functionPanelScore = pillar ? clampScore(combinedFromTests) : 70;

  // Combinar todo Function - Tabaco tiene más peso por ser crítico
  const combined =
    bmiScore * 0.25 +
    ageScore * 0.2 +
    diagnosesScore * 0.15 +
    smokingScore * 0.2 + // Aumentado de 10% a 20% por ser crítico
    functionPanelScore * 0.2; // Reducido de 30% a 20% para compensar

  return clampScore(combined);
}

function calculateFunctionDynamic(user: UserProfile, logs: DailyLog[]): number {
  // De momento, Function depende sobre todo de baseline clínico.
  // Aquí podríamos añadir dinámica de analíticas periódicas en el futuro.
  // Para MVP robusto devolvemos neutro-bajo (reducido de 70-80 a 60-70).
  if (!logs.length) return 60;
  return 70;
}

/**
 * ============================
 * PILAR FOOD (nutrición/hábitos)
 * ============================
 */
function calculateFoodBaseline(user: UserProfile, pillar?: PillarFood | null): number {
  // -------------------------
  // 1) Alcohol (perfil + pilar FOOD) - Penalización estricta
  // -------------------------
  let alcoholScore = 70;
  const alcoholSource = pillar?.alcohol_consumption ?? user.alcoholConsumption;
  if (alcoholSource) {
    const val = alcoholSource.toLowerCase();
    if (val.includes('no')) alcoholScore = 100;
    else if (val.includes('ocasional')) alcoholScore = 75; // Reducido de 85
    else if (val.includes('frecuente')) alcoholScore = 30; // Crítico: reducido de 55 a 30
  }

  // -------------------------
  // 2) Suplementos (perfil + pilar FOOD)
  // -------------------------
  let supplementsScore = 60; // Reducido de 70
  const supplementsSource = pillar?.supplements ?? user.supplements;
  if (supplementsSource) {
    const text = supplementsSource.toLowerCase();
    if (text.includes('sí') || text.includes('yes') || text.includes('supp')) {
      supplementsScore = 90;
    }
  }

  // -------------------------
  // 3) Proteína diaria (g)
  // -------------------------
  let proteinScore = 65; // Reducido de 80
  if (pillar?.daily_protein !== undefined) {
    const p = pillar.daily_protein;
    if (p >= 70 && p <= 120) proteinScore = 100;
    else if (p >= 50 && p < 70) proteinScore = 85;
    else if (p >= 40 && p < 50) proteinScore = 70;
    else proteinScore = 55; // Reducido de 60
  }

  // -------------------------
  // 4) Fibra diaria (g)
  // -------------------------
  let fiberScore = 65; // Reducido de 80
  if (pillar?.daily_fiber !== undefined) {
    const f = pillar.daily_fiber;
    if (f >= 25 && f <= 35) fiberScore = 100;
    else if (f >= 18 && f < 25) fiberScore = 85;
    else if (f >= 12 && f < 18) fiberScore = 70;
    else fiberScore = 50; // Reducido de 55
  }

  // -------------------------
  // 5) Diversidad vegetal (0–7)
  // -------------------------
  let diversityScore = 60; // Reducido de 80
  if (pillar?.vegetable_diversity !== undefined) {
    const d = pillar.vegetable_diversity;
    if (d >= 5) diversityScore = 100;
    else if (d >= 3) diversityScore = 80;
    else if (d >= 1) diversityScore = 60; // Reducido de 65
    else diversityScore = 40; // Reducido de 50
  }

  // -------------------------
  // 6) Ultraprocesados (texto)
  // -------------------------
  let ultraprocessedScore = 65; // Reducido de 80
  if (pillar?.ultraprocessed) {
    const val = pillar.ultraprocessed.toLowerCase();
    if (val.includes('nunca')) ultraprocessedScore = 100;
    else if (val.includes('1-2')) ultraprocessedScore = 75; // Reducido de 85
    else if (val.includes('3-4')) ultraprocessedScore = 55; // Reducido de 65
    else if (val.includes('5+')) ultraprocessedScore = 30; // Reducido de 45
  }

  // -------------------------
  // 7) Omega-3 en dieta
  // -------------------------
  let omegaScore = 65; // Reducido de 80
  if (pillar?.omega3) {
    const val = pillar.omega3.toLowerCase();
    if (val.includes('alto')) omegaScore = 100;
    else if (val.includes('moderado')) omegaScore = 85;
    else if (val.includes('bajo')) omegaScore = 55; // Reducido de 65
  }

  // -------------------------
  // 8) Horarios de comida
  // -------------------------
  let scheduleScore = 65; // Reducido de 80
  if (pillar?.meal_schedule) {
    const val = pillar.meal_schedule.toLowerCase();
    if (val.includes('regulares')) scheduleScore = 100;
    else scheduleScore = 60; // Reducido de 70
  }

  // -------------------------
  // 9) Sintomatología digestiva
  // -------------------------
  let digestiveScore = 70; // Reducido de 85
  if (pillar?.digestive_symptoms) {
    const text = pillar.digestive_symptoms.trim();
    if (text.length > 0) digestiveScore = 55; // síntomas presentes → mayor penalización (de 70 a 55)
  }

  // -------------------------
  // 10) Escala de Bristol
  // -------------------------
  let bristolScore = 65; // Reducido de 80
  if (pillar?.bristol_stool_scale !== undefined) {
    const b = pillar.bristol_stool_scale;
    if (b >= 3 && b <= 4) bristolScore = 100;
    else if (b === 2 || b === 5) bristolScore = 70; // Reducido de 75
    else bristolScore = 50; // Reducido de 60
  }

  // -------------------------
  // 11) Cintura (cm)
  // -------------------------
  let waistScore = 65; // Reducido de 80
  if (pillar?.waist_circumference !== undefined) {
    const w = pillar.waist_circumference;
    if (w <= 80) waistScore = 100;
    else if (w <= 88) waistScore = 80; // Reducido de 85
    else waistScore = 55; // Reducido de 65
  }

  // -------------------------
  // 12) Ejercicio semanal
  // -------------------------
  let exerciseScore = 60; // Reducido de 80
  if (pillar?.weekly_exercise) {
    const v = pillar.weekly_exercise.toLowerCase();
    if (v.includes('3-4') || v.includes('5+')) exerciseScore = 100;
    else if (v.includes('1-2')) exerciseScore = 75; // Reducido de 80
    else exerciseScore = 50; // Reducido de 65
  }

  // Alcohol tiene más peso por ser crítico
  const combined =
    alcoholScore * 0.25 + // Aumentado de 15% a 25%
    supplementsScore * 0.08 +
    proteinScore * 0.12 +
    fiberScore * 0.12 +
    diversityScore * 0.08 +
    ultraprocessedScore * 0.08 +
    omegaScore * 0.05 +
    scheduleScore * 0.04 +
    digestiveScore * 0.04 +
    bristolScore * 0.04 +
    waistScore * 0.05 +
    exerciseScore * 0.05;

  return clampScore(combined);
}

function calculateFoodDynamic(logs: DailyLog[]): number {
  if (!logs.length) return 60; // Reducido de 70

  const recentLogs = logs.slice(0, 14);
  const avgs = calculateAverages(recentLogs);

  // Verduras: objetivo >=5 raciones/día
  const veggiesVal = parseFloat((avgs as any).veggies || '0');
  let veggiesScore = 50; // Reducido de 60
  if (veggiesVal >= 5) veggiesScore = 100;
  else if (veggiesVal >= 3) veggiesScore = 75; // Reducido de 80
  else if (veggiesVal >= 1) veggiesScore = 60; // Reducido de 65
  else veggiesScore = 40; // Reducido de 50

  // Alcohol en logs - Penalización más estricta
  const alcoholDays = recentLogs.filter(l => l.alcohol).length;
  let alcoholScore = 100;
  if (alcoholDays === 0) alcoholScore = 100;
  else if (alcoholDays <= 2) alcoholScore = 70; // Reducido de 85
  else if (alcoholDays <= 4) alcoholScore = 50; // Reducido de 65
  else alcoholScore = 25; // Crítico: reducido de 45 a 25

  // Agua si está disponible (waterGlasses)
  const waterVals = recentLogs
    .map(l => l.waterGlasses)
    .filter(v => typeof v === 'number' && v >= 0) as number[];
  let waterScore = 60; // Reducido de 75
  if (waterVals.length) {
    const avgWater = waterVals.reduce((a, b) => a + b, 0) / waterVals.length;
    if (avgWater >= 6 && avgWater <= 10) waterScore = 100;
    else if (avgWater >= 4) waterScore = 80; // Reducido de 85
    else waterScore = 55; // Reducido de 65
  }

  const combined =
    veggiesScore * 0.5 +
    alcoholScore * 0.3 +
    waterScore * 0.2;

  return clampScore(combined);
}

/**
 * ============================
 * PILAR FLORA (sueño / microbiota)
 * ============================
 */
function calculateFloraScore(logs: DailyLog[], pillar?: PillarFlora | null): number {
  // -------------------------
  // 1) Baseline FLORA (microbiota e historial)
  // -------------------------
  let antibioticsScore = 70; // Reducido de 85
  if (pillar?.antibiotics_last_12_months) {
    const v = pillar.antibiotics_last_12_months.toLowerCase();
    if (v.includes('no')) antibioticsScore = 100;
    else if (v.includes('1 vez')) antibioticsScore = 75; // Reducido de 80
    else antibioticsScore = 50; // 2+ veces: reducido de 60 a 50
  }

  let infectionsScore = 75; // Reducido de 90
  if (pillar?.vaginal_infections === true) infectionsScore = 55; // Reducido de 70

  let phScore = 75; // Reducido de 90
  if (pillar?.altered_vaginal_ph === true) phScore = 55; // Reducido de 70

  let probioticsScore = 65; // Reducido de 80
  if (pillar?.previous_probiotics === true) probioticsScore = 90;

  let microbiomeTestsScore = 65; // Reducido de 80
  if (pillar?.microbiome_tests) {
    const v = pillar.microbiome_tests.toLowerCase();
    if (v.includes('ambas') || v.includes('test')) microbiomeTestsScore = 90;
  }

  let recommendedSuppsScore = 65; // Reducido de 80
  if (pillar?.recommended_supplements) {
    const v = pillar.recommended_supplements.toLowerCase();
    if (v.includes('probióticos') || v.includes('prebióticos')) recommendedSuppsScore = 90;
  }

  let floraBristolScore = 65; // Reducido de 80
  if (pillar?.bristol_stool_scale !== undefined) {
    const b = pillar.bristol_stool_scale;
    if (b >= 3 && b <= 4) floraBristolScore = 100;
    else if (b === 2 || b === 5) floraBristolScore = 70; // Reducido de 75
    else floraBristolScore = 50; // Reducido de 60
  }

  const floraBaseline =
    antibioticsScore * 0.2 +
    infectionsScore * 0.2 +
    phScore * 0.15 +
    probioticsScore * 0.1 +
    microbiomeTestsScore * 0.1 +
    recommendedSuppsScore * 0.1 +
    floraBristolScore * 0.15;

  const baselineScore = clampScore(pillar ? floraBaseline : 65); // si no hay datos, neutro reducido (de 80 a 65)

  // -------------------------
  // 2) Dinámica: sueño de logs
  // -------------------------
  if (!logs.length) return baselineScore;

  const recentLogs = logs.slice(0, 14);
  const avgs = calculateAverages(recentLogs);

  const sleepVal = parseFloat((avgs as any).sleep || '0');
  let sleepScore = 55; // Reducido de 70 - poco sueño es crítico
  if (sleepVal >= 7 && sleepVal <= 9) {
    sleepScore = 100;
  } else if (sleepVal >= 6 && sleepVal < 7) {
    sleepScore = 80; // Reducido de 85
  } else if (sleepVal >= 5 && sleepVal < 6) {
    sleepScore = 60; // Reducido de 70
  } else if (sleepVal > 9) {
    sleepScore = 75; // Reducido de 80
  } else {
    sleepScore = 40; // Crítico: reducido de 55 a 40 para <5 horas
  }

  const dynamicScore = clampScore(sleepScore);

  // Flora combina baseline (historial) + dinámica (sueño reciente)
  return clampScore(baselineScore * 0.6 + dynamicScore * 0.4);
}

/**
 * ============================
 * PILAR FLOW (estrés / hormonal / emocional)
 * ============================
 */
function calculateFlowScore(user: UserProfile, logs: DailyLog[], pillar?: PillarFlow | null): number {
  // -------------------------
  // 1) Baseline FLOW (pilar Flow) - Penalizaciones más estrictas
  // -------------------------
  let baselineStress = 65; // Reducido de 80 - estrés alto es crítico
  if (pillar?.stress_level !== undefined) {
    // 1 (mejor) -> 100, 5 (peor) -> 0
    baselineStress = clampScore(((5 - pillar.stress_level) / 4) * 100);
  }

  let baselineSleepHours = 65; // Reducido de 80
  if (pillar?.sleep_hours_avg !== undefined) {
    const h = pillar.sleep_hours_avg;
    if (h >= 7 && h <= 9) baselineSleepHours = 100;
    else if (h >= 6 && h < 7) baselineSleepHours = 75; // Reducido de 85
    else if (h >= 5 && h < 6) baselineSleepHours = 55; // Reducido de 70
    else baselineSleepHours = 40; // Crítico: reducido de 60 a 40 para <5 horas
  }

  let baselineMentalLoad = 65; // Reducido de 80
  if (pillar?.mental_load !== undefined) {
    // 0–4 (0 mejor)
    baselineMentalLoad = clampScore(((4 - pillar.mental_load) / 4) * 100);
  }

  let baselineRumination = 65; // Reducido de 80
  if (pillar?.mental_rumination !== undefined) {
    baselineRumination = clampScore(((4 - pillar.mental_rumination) / 4) * 100);
  }

  let baselineScreens = 65; // Reducido de 80
  if (pillar?.nighttime_screen_use !== undefined) {
    const s = pillar.nighttime_screen_use;
    if (s <= 1) baselineScreens = 100;
    else if (s === 2) baselineScreens = 75; // Reducido de 80
    else baselineScreens = 50; // Reducido de 60
  }

  let baselineSupport = 70; // Reducido de 85
  if (pillar?.emotional_support === false) baselineSupport = 55; // Reducido de 65

  let baselineLoneliness = 65; // Reducido de 80
  if (pillar?.loneliness !== undefined) {
    baselineLoneliness = clampScore(((4 - pillar.loneliness) / 4) * 100);
  }

  let baselineConflicts = 70; // Reducido de 85
  if (pillar?.frequent_conflicts === true) baselineConflicts = 50; // Reducido de 65

  let baselineLibido = 65; // Reducido de 80
  if (pillar?.libido !== undefined) {
    // Asumimos que libido media–alta es buena señal (2–3)
    if (pillar.libido >= 2 && pillar.libido <= 3) baselineLibido = 100;
    else if (pillar.libido === 1) baselineLibido = 75; // Reducido de 80
    else baselineLibido = 60; // Reducido de 70
  }

  let baselineConnection = 65; // Reducido de 80
  if (pillar?.emotional_connection_partner !== undefined) {
    if (pillar.emotional_connection_partner >= 3) baselineConnection = 100;
    else if (pillar.emotional_connection_partner === 2) baselineConnection = 80; // Reducido de 85
    else baselineConnection = 60; // Reducido de 70
  }

  let baselinePain = 70; // Reducido de 85
  if (pillar?.pain_dryness_relationships === true) baselinePain = 50; // Reducido de 60

  let baselineFertilityAnxiety = 65; // Reducido de 80
  if (pillar?.fertility_anxiety_relationships === true) baselineFertilityAnxiety = 50; // Reducido de 65

  let baselineSnacks = 65; // Reducido de 80
  if (pillar?.off_schedule_snacks) {
    const v = pillar.off_schedule_snacks.toLowerCase();
    if (v.includes('nunca')) baselineSnacks = 100;
    else if (v.includes('pocas')) baselineSnacks = 75; // Reducido de 85
    else baselineSnacks = 55; // Reducido de 70
  }

  const hasPillarFlow = !!pillar;
  const flowBaselineCombined = hasPillarFlow
    ? clampScore(
        baselineStress * 0.2 +
          baselineSleepHours * 0.15 +
          baselineMentalLoad * 0.1 +
          baselineRumination * 0.05 +
          baselineScreens * 0.05 +
          baselineSupport * 0.1 +
          baselineLoneliness * 0.05 +
          baselineConflicts * 0.05 +
          baselineLibido * 0.05 +
          baselineConnection * 0.05 +
          baselinePain * 0.05 +
          baselineFertilityAnxiety * 0.05 +
          baselineSnacks * 0.05
      )
    : 60; // sin pilar, baseline reducido (de 80 a 60)

  // -------------------------
  // 2) Dinámica FLOW (logs)
  // -------------------------
  if (!logs.length) {
    // Sin logs: devolvemos sólo baseline de Flow
    return clampScore(flowBaselineCombined);
  }

  const recentLogs = logs.slice(0, 14);
  const avgs = calculateAverages(recentLogs);

  // Estrés medio (1–5) - Penalización más estricta
  const stressVal = parseFloat((avgs as any).stress || '0');
  let stressScore = 60; // Reducido de 80 - estrés alto es crítico
  if (!Number.isNaN(stressVal) && stressVal > 0) {
    // 1 (mejor) -> 100, 5 (peor) -> 0
    stressScore = clampScore(((5 - stressVal) / 4) * 100);
  }

  // Regularidad del ciclo
  const regularityScore =
    user.cycleRegularity === 'Regular'
      ? 100
      : user.cycleRegularity === 'Irregular'
      ? 70
      : 80;

  // Estabilidad BBT (hormonal)
  const bbtValues = recentLogs
    .map(l => l.bbt)
    .filter(b => typeof b === 'number' && b !== null && !Number.isNaN(b) && b > 0) as number[];

  let bbtScore = 75;
  if (bbtValues.length >= 3) {
    const sd = calculateStandardDeviation(bbtValues);
    if (sd <= 0.15) {
      bbtScore = 100;
    } else if (sd >= 0.5) {
      bbtScore = 45;
    } else {
      // Interpolar entre 0.15 y 0.5
      const t = (sd - 0.15) / (0.5 - 0.15); // 0–1
      bbtScore = 100 - t * 55; // de 100 a 45
    }
  }

  const combined =
    stressScore * 0.4 +
    regularityScore * 0.3 +
    bbtScore * 0.3;

  const dynamicScore = clampScore(combined);

  // Flow final = 60% baseline (pilar) + 40% dinámica (logs)
  return clampScore(flowBaselineCombined * 0.6 + dynamicScore * 0.4);
}

/**
 * Cálculo principal del FertyScore
 * Combina baseline (pilares) + dinámica (logs) y devuelve scores redondeados.
 */
export const calculateFertyScore = (
  user: UserProfile,
  logs: DailyLog[],
  pillars: FertyPillars
) => {
  const functionBaseline = calculateFunctionBaseline(user, pillars.function);
  const functionDynamic = calculateFunctionDynamic(user, logs);
  const functionScore = clampScore(functionBaseline * 0.7 + functionDynamic * 0.3);

  const foodBaseline = calculateFoodBaseline(user, pillars.food);
  const foodDynamic = calculateFoodDynamic(logs);
  const foodScore = clampScore(foodBaseline * 0.6 + foodDynamic * 0.4);

  const floraScore = calculateFloraScore(logs, pillars.flora);
  const flowScore = calculateFlowScore(user, logs, pillars.flow);

  // Ponderación igual entre pilares (25% cada uno)
  const totalScore =
    functionScore * 0.25 +
    foodScore * 0.25 +
    floraScore * 0.25 +
    flowScore * 0.25;

  return {
    total: Math.round(totalScore),
    function: Math.round(functionScore),
    food: Math.round(foodScore),
    flora: Math.round(floraScore),
    flow: Math.round(flowScore)
  };
};

