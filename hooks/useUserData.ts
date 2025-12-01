/**
 * Custom hook for user data fetching
 * Now delegates to centralized services for consistency
 */

import { DailyLog, ConsultationForm, AppNotification, AdminReport, CourseModule } from '../types';
import { formatDateForDB } from '../services/dataService';
import {
  fetchLogsForUser,
  fetchAllLogsForUser,
  fetchNotificationsForUser,
  fetchUserFormsForUser,
  fetchReportsForUser,
  fetchEducationForUser
} from '../services/userDataService';
import { logger } from '../lib/logger';

/**
 * Hook for fetching user logs with pagination (default: last 90 days)
 * Now uses centralized service with retry logic
 */
export const useFetchLogs = () => {
  const fetchLogs = async (
    userId: string,
    daysLimit: number = 90,
    onSuccess?: (logs: DailyLog[]) => void,
    onError?: (error: string) => void
  ): Promise<DailyLog[]> => {
    try {
      const logs = await fetchLogsForUser(userId, daysLimit);
      onSuccess?.(logs);
      return logs;
    } catch (error: any) {
      logger.error('❌ Error in fetchLogs hook:', error);
      onError?.('Error cargando registros: ' + (error?.message || 'Error desconocido'));
      return [];
    }
  };

  const fetchAllLogs = async (
    userId: string,
    onSuccess?: (logs: DailyLog[]) => void,
    onError?: (error: string) => void
  ): Promise<DailyLog[]> => {
    try {
      const logs = await fetchAllLogsForUser(userId);
      onSuccess?.(logs);
      return logs;
    } catch (error: any) {
      logger.error('❌ Error in fetchAllLogs hook:', error);
      onError?.('Error cargando historial completo: ' + (error?.message || 'Error desconocido'));
      return [];
    }
  };

  return { fetchLogs, fetchAllLogs };
};

/**
 * Hook for fetching user notifications
 * Now uses centralized service with retry logic
 */
export const useFetchNotifications = () => {
  const fetchNotifications = async (
    userId: string,
    onSuccess?: (notifications: AppNotification[]) => void
  ): Promise<AppNotification[]> => {
    try {
      const notifications = await fetchNotificationsForUser(userId);
      onSuccess?.(notifications);
      return notifications;
    } catch (error) {
      logger.error('❌ Error in fetchNotifications hook:', error);
      return [];
    }
  };

  return { fetchNotifications };
};

/**
 * Hook for fetching user forms
 * Now uses centralized service with retry logic
 */
export const useFetchUserForms = () => {
  const fetchUserForms = async (
    userId: string,
    onSuccess?: (forms: ConsultationForm[]) => void,
    onError?: (error: string) => void
  ): Promise<ConsultationForm[]> => {
    try {
      const forms = await fetchUserFormsForUser(userId);
      onSuccess?.(forms);
      return forms;
    } catch (error: any) {
      logger.error('❌ Error in fetchUserForms hook:', error);
      onError?.('Error cargando formularios: ' + (error?.message || 'Error desconocido'));
      return [];
    }
  };

  return { fetchUserForms };
};

/**
 * Hook for fetching admin reports
 * Now uses centralized service
 */
export const useFetchReports = () => {
  const fetchReports = async (
    userId: string,
    onSuccess?: (reports: AdminReport[]) => void
  ): Promise<AdminReport[]> => {
    try {
      const reports = await fetchReportsForUser(userId);
      onSuccess?.(reports);
      return reports;
    } catch (error) {
      logger.error('❌ Error in fetchReports hook:', error);
      return [];
    }
  };

  return { fetchReports };
};

/**
 * Hook for fetching education content
 * Now uses centralized service
 */
export const useFetchEducation = () => {
  const fetchEducation = async (
    userId: string,
    methodStart?: string,
    onSuccess?: (modules: CourseModule[]) => void
  ): Promise<CourseModule[]> => {
    try {
      const modules = await fetchEducationForUser(userId, methodStart);
      onSuccess?.(modules);
      return modules;
    } catch (error) {
      logger.error('❌ Error in fetchEducation hook:', error);
      return [];
    }
  };

  return { fetchEducation };
};

/**
 * Helper function to initialize today's log from existing logs
 */
export const initializeTodayLog = (
  logs: DailyLog[],
  setTodayLog: (log: Partial<DailyLog>) => void
) => {
  const todayStr = formatDateForDB(new Date());
  const existingToday = logs.find(l => l.date === todayStr);

  if (existingToday) {
    setTodayLog(existingToday);
  } else if (logs.length > 0) {
    const last = logs[0];
    const diff = Math.ceil(
      Math.abs(new Date().getTime() - new Date(last.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    setTodayLog({
      date: todayStr,
      cycleDay: (last.cycleDay + diff) || 1,
      symptoms: [],
      alcohol: false,
      lhTest: 'No realizado',
      activityMinutes: 0,
      sunMinutes: 0
    });
  }
};

