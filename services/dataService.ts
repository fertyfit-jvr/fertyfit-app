
import { DailyLog } from '../types';
import { parseLocalDate, formatToISO } from './dateUtils';
import { logger } from '../lib/logger';

export const calculateAverages = (logs: DailyLog[]) => {
  if (!logs || logs.length === 0) return { sleep: '0.0', veggies: '0.0', water: '0.0', stress: '0.0' };
  
  const total = logs.reduce((acc, log) => ({
    sleep: acc.sleep + (log.sleepHours || 0),
    veggies: acc.veggies + (log.veggieServings || 0),
    water: acc.water + (log.waterGlasses || 0),
    stress: acc.stress + (log.stressLevel || 0),
  }), { sleep: 0, veggies: 0, water: 0, stress: 0 });

  return {
    sleep: (total.sleep / logs.length).toFixed(1),
    veggies: (total.veggies / logs.length).toFixed(1),
    water: (total.water / logs.length).toFixed(1),
    stress: (total.stress / logs.length).toFixed(1),
  };
};

export const calculateAlcoholFreeStreak = (logs: DailyLog[]): number => {
  if (!logs || logs.length === 0) return 0;
  
  // Sort descending (newest first) just to be safe
  const sortedLogs = [...logs].sort((a, b) => {
    const db = parseLocalDate(b.date);
    const da = parseLocalDate(a.date);
    return (db?.getTime() || 0) - (da?.getTime() || 0);
  });
  
  let streak = 0;
  // Strict logic: Count consecutive days from the most recent log backwards where alcohol is false.
  // Break immediately if alcohol is true.
  for (const log of sortedLogs) {
      if (log.alcohol === false) { 
          streak++;
      } else {
          break; 
      }
  }
  return streak;
};

export const getLastLogDetails = (logs: DailyLog[]) => {
    if (!logs || logs.length === 0) return { date: '-', cycleDay: '-' };
    const last = logs[0]; 
    const dateObj = parseLocalDate(last.date) ?? new Date();
    return {
        date: dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        cycleDay: last.cycleDay
    };
};

/**
 * Formats a date to YYYY-MM-DD format for database storage
 * Uses local timezone to avoid day-shift issues (e.g., user in UTC+1 at 23:00)
 * 
 * @param date - Date object or date string
 * @returns Formatted date string (YYYY-MM-DD) in local timezone
 */
export const formatDateForDB = (date: Date | string): string => {
    if (!date) {
      return formatToISO(new Date());
    }
    if (typeof date === 'string') {
      const parsed = parseLocalDate(date);
      return formatToISO(parsed ?? new Date());
    }
    return formatToISO(date);
};

// --- NEW FUNCTIONS FOR DASHBOARD PRO ---

// Devuelve BMI como número para poder usarlo tanto en UI como en scoring.
export const calculateBMI = (weight: number, height: number): number => {
  if (!weight || !height || height === 0) return NaN;

  // Smart detection: If height > 3, assume cm (e.g. 165), convert to meters (1.65)
  // If height < 3, assume meters (e.g. 1.65)
  let h = height;
  if (h > 3) {
    h = h / 100;
  }

  const bmi = weight / (h * h);
  if (!Number.isFinite(bmi) || Number.isNaN(bmi)) return NaN;
  return Number(bmi.toFixed(1));
};

export const getBMIStatus = (bmiStr: string): { status: string, color: string, bg: string } => {
  const bmi = parseFloat(bmiStr);
  if (Number.isNaN(bmi)) return { status: '-', color: 'text-stone-400', bg: 'bg-stone-50' };
  
  if (bmi < 18.5) return { status: 'Bajo Peso', color: 'text-amber-600', bg: 'bg-amber-50' };
  if (bmi >= 18.5 && bmi < 24.9) return { status: 'Peso Saludable', color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (bmi >= 25 && bmi < 29.9) return { status: 'Sobrepeso', color: 'text-orange-600', bg: 'bg-orange-50' };
  return { status: 'Obesidad', color: 'text-rose-600', bg: 'bg-rose-50' };
};

export const calculateVitalityStats = (logs: DailyLog[]): string => {
  if (!logs || logs.length === 0) return '0%';
  
  // Consider last 7 days logs
  const recentLogs = logs.slice(0, 7);
  if (recentLogs.length === 0) return '0%';

  let totalScore = 0;
  let maxPossibleScore = recentLogs.length * 2; // 1 point for sun, 1 for activity per day

  recentLogs.forEach(log => {
     if ((log.sunMinutes || 0) >= 10) totalScore += 1;
     if ((log.activityMinutes || 0) >= 20) totalScore += 1;
  });

  if (maxPossibleScore === 0) return '0%';
  const percentage = Math.round((totalScore / maxPossibleScore) * 100);
  return `${percentage}%`;
};

export const calculateDaysOnMethod = (startDateStr: string | undefined | null): number => {
    if (!startDateStr) {
        logger.warn('[calculateDaysOnMethod] No start date provided');
        return 0; // Returns 0 if not started
    }
    
    // Normalize date string: if it includes time, extract only the date part
    const dateOnlyStr = startDateStr.split('T')[0].split(' ')[0]; // Handle both ISO and space-separated formats
    
    const start = parseLocalDate(dateOnlyStr);
    if (!start) {
        logger.error('[calculateDaysOnMethod] Failed to parse start date:', startDateStr, '-> extracted:', dateOnlyStr);
        return 0;
    }
    
    const now = new Date();
    
    // Force strict day calculation ignoring hours to fix timezone issues
    const utc1 = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const utc2 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffDays = Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
    const result = Math.max(1, diffDays + 1);
    
    // Debug logging (only in development)
    logger.log('[calculateDaysOnMethod]', {
        startDateStr,
        dateOnlyStr,
        start: start.toISOString().split('T')[0],
        now: now.toISOString().split('T')[0],
        diffDays,
        result
    });
    
    return result;
};

export const calculateCurrentWeek = (daysActive: number): number => {
    if (daysActive <= 0) return 0;
    // Day 1-7 = Week 1, Day 8-14 = Week 2, etc.
    return Math.ceil(daysActive / 7);
};
