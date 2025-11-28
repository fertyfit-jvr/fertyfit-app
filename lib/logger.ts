/**
 * Centralized Logger
 * Only logs in development, errors always logged
 */

const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but in production could send to logging service
    console.error(...args);
    // TODO: In production, send to logging service (Sentry, LogRocket, etc.)
    // if (!isDevelopment) {
    //   sendToLoggingService('error', args);
    // }
  },
  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

