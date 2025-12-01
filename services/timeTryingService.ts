/**
 * Service for calculating and managing "tiempo buscando embarazo"
 * Calculates dynamically based on start_date and initial_months
 */

import { supabase } from './supabase';
import { logger } from '../lib/logger';

export interface TimeTryingData {
  startDate: string | null;
  initialMonths: number | null;
  currentMonths: number | null;
}

/**
 * Calculates current months trying to conceive
 * @param startDate - Date when user started trying (YYYY-MM-DD)
 * @param initialMonths - Initial months value at registration
 * @returns Current total months trying
 */
export function calculateCurrentMonthsTrying(
  startDate: string | null,
  initialMonths: number | null
): number | null {
  if (!startDate) {
    return null;
  }

  const start = new Date(startDate);
  const today = new Date();
  
  if (isNaN(start.getTime())) {
    logger.warn('Invalid startDate for time_trying calculation:', startDate);
    return null;
  }

  // Calculate months difference
  const monthsDiff = (today.getFullYear() - start.getFullYear()) * 12 + 
                     (today.getMonth() - start.getMonth());

  // Return initial months + months passed
  return (initialMonths || 0) + Math.max(0, monthsDiff);
}

/**
 * Fetches time trying data from database
 * @param userId - User ID
 * @returns TimeTryingData or null
 */
export async function fetchTimeTryingData(userId: string): Promise<TimeTryingData | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('time_trying_start_date, time_trying_initial_months')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching time trying data:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const startDate = data.time_trying_start_date;
    const initialMonths = data.time_trying_initial_months 
      ? parseInt(String(data.time_trying_initial_months)) 
      : null;

    const currentMonths = calculateCurrentMonthsTrying(startDate, initialMonths);

    return {
      startDate,
      initialMonths,
      currentMonths
    };
  } catch (error) {
    logger.error('Error in fetchTimeTryingData:', error);
    return null;
  }
}

/**
 * Sets time trying start date and initial months
 * Should be called when F0 is first submitted
 * @param userId - User ID
 * @param initialMonths - Initial months trying value from F0
 * @param startDate - Optional start date (defaults to today)
 */
export async function setTimeTryingStart(
  userId: string,
  initialMonths: number,
  startDate?: string
): Promise<boolean> {
  try {
    const dateToUse = startDate || new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('profiles')
      .update({
        time_trying_start_date: dateToUse,
        time_trying_initial_months: initialMonths
      })
      .eq('id', userId);

    if (error) {
      logger.error('Error setting time trying start:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error in setTimeTryingStart:', error);
    return false;
  }
}
