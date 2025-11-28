/**
 * FertyScore calculation service
 * Separates business logic for calculating FertyScore from UI components
 */

import { UserProfile, DailyLog } from '../types';
import { calculateAverages, calculateBMI } from './dataService';

/**
 * Calculates standard deviation for BBT values
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - mean, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquareDiff);
}

/**
 * Calculates the FertyScore based on user profile and recent logs
 * Returns scores for each pillar (Function, Food, Flora, Flow) and total score
 */
export const calculateFertyScore = (user: UserProfile, logs: DailyLog[]) => {
  const recentLogs = logs.slice(0, 14);
  const avgs = recentLogs.length > 0 ? calculateAverages(recentLogs) : { sleep: '0', veggies: '0', stress: '0' };

  // ========================================
  // PILAR 1: FUNCTION (25%) - Physical Health
  // ========================================
  let functionScore = 100;

  // BMI Logic (optimal 20-25)
  const bmi = calculateBMI(user.weight, user.height);
  const bmiVal = parseFloat(bmi);
  if (!isNaN(bmiVal)) {
    if (bmiVal < 18.5) functionScore -= (18.5 - bmiVal) * 8; // Underweight penalty
    else if (bmiVal >= 18.5 && bmiVal <= 25) functionScore = 100; // Optimal
    else if (bmiVal > 25) functionScore -= (bmiVal - 25) * 3; // Overweight penalty
  }

  // Age Logic (optimal <35)
  if (user.age > 35) {
    functionScore -= (user.age - 35) * 2;
  } else if (user.age < 25) {
    functionScore -= (25 - user.age) * 1;
  }

  // Diagnoses Impact
  const riskyDiagnoses = ['SOP', 'Endometriosis', 'Ovarios Poliquísticos', 'PCOS'];
  if (user.diagnoses && user.diagnoses.some(d => riskyDiagnoses.some(rd => d.includes(rd)))) {
    functionScore -= 20;
  }

  // Smoking (major impact on function)
  if (user.smoker && user.smoker.toLowerCase() !== 'no') {
    functionScore -= 25;
  }

  functionScore = Math.max(0, Math.min(100, functionScore));

  // ========================================
  // PILAR 2: FOOD (25%) - Nutrition & Habits
  // ========================================
  let foodScore = 0;

  if (recentLogs.length > 0) {
    // Vegetable intake (target 5 servings)
    const veggieScore = Math.min(100, (parseFloat(avgs.veggies) / 5) * 100);

    // Alcohol penalty (>2 days in 14 = bad)
    const alcoholDays = recentLogs.filter(l => l.alcohol).length;
    const alcoholScore = alcoholDays > 2 ? Math.max(0, 100 - (alcoholDays * 10)) : 100;

    // Supplements bonus (if taking supplements)
    // TODO: Add supplements tracking from F0
    const supplementsScore = 80; // Placeholder - will be calculated from F0 data

    foodScore = (veggieScore * 0.4) + (alcoholScore * 0.4) + (supplementsScore * 0.2);
  } else {
    foodScore = 70; // Default baseline
  }

  foodScore = Math.max(0, Math.min(100, foodScore));

  // ========================================
  // PILAR 3: FLORA (25%) - Microbiota & Rest
  // ========================================
  let floraScore = 0;

  if (recentLogs.length > 0) {
    // Sleep quality (target 7.5 hours)
    const sleepVal = parseFloat(avgs.sleep);
    let sleepScore = 0;
    if (sleepVal >= 7 && sleepVal <= 9) {
      sleepScore = 100; // Optimal
    } else if (sleepVal < 7) {
      sleepScore = Math.max(0, (sleepVal / 7) * 100);
    } else {
      sleepScore = Math.max(0, 100 - ((sleepVal - 9) * 10));
    }

    // Digestive health (based on symptoms)
    // TODO: Track digestive symptoms in daily logs
    const digestiveScore = 80; // Placeholder

    // Probiotics/Gut health
    // TODO: Add from F0 supplements
    const gutHealthScore = 75; // Placeholder

    floraScore = (sleepScore * 0.5) + (digestiveScore * 0.3) + (gutHealthScore * 0.2);
  } else {
    floraScore = 70; // Default baseline
  }

  floraScore = Math.max(0, Math.min(100, floraScore));

  // ========================================
  // PILAR 4: FLOW (25%) - Stress & Emotional
  // ========================================
  let flowScore = 0;

  if (recentLogs.length > 0) {
    // Stress levels (1=best, 5=worst)
    const stressVal = parseFloat(avgs.stress);
    const stressScore = Math.max(0, ((5 - stressVal) / 4) * 100);

    // Cycle regularity
    const regularityScore = user.cycleRegularity === 'Regular' ? 100 :
      (user.cycleRegularity === 'Irregular' ? 50 : 75);

    // BBT Stability (hormonal flow)
    const bbtValues = recentLogs.map(l => l.bbt).filter(b => b !== undefined && b > 0) as number[];
    let bbtScore = 75; // Default
    if (bbtValues.length >= 3) {
      const sd = calculateStandardDeviation(bbtValues);
      if (sd <= 0.2) bbtScore = 100;
      else if (sd >= 0.5) bbtScore = 40;
      else bbtScore = 100 - ((sd - 0.2) * 200);
    }

    // Emotional wellbeing
    // TODO: Add happiness/mood tracking
    const emotionalScore = 80; // Placeholder

    flowScore = (stressScore * 0.3) + (regularityScore * 0.3) + (bbtScore * 0.2) + (emotionalScore * 0.2);
  } else {
    flowScore = 70; // Default baseline
  }

  flowScore = Math.max(0, Math.min(100, flowScore));

  // ========================================
  // TOTAL SCORE (Equal weight: 25% each)
  // ========================================
  const totalScore = (functionScore * 0.25) + (foodScore * 0.25) + (floraScore * 0.25) + (flowScore * 0.25);

  return {
    total: Math.round(totalScore),
    function: Math.round(functionScore),
    food: Math.round(foodScore),
    flora: Math.round(floraScore),
    flow: Math.round(flowScore)
  };
};

