/**
 * Utility functions for date formatting and common operations
 */

/**
 * Formats a date string to a readable format in Spanish
 * @param dateStr - Date string or undefined
 * @param format - Format type: 'short' (default) or 'long'
 * @returns Formatted date string
 */
export const formatDate = (dateStr: string | undefined, format: 'short' | 'long' = 'short'): string => {
  if (!dateStr) return 'No registrada';
  
  const date = new Date(dateStr);
  
  if (format === 'long') {
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }
  
  // Short format (default)
  return date.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

/**
 * Formats current date to a readable format
 * @returns Formatted current date string
 */
export const formatCurrentDate = (): string => {
  return new Date().toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

/**
 * Helper function for retry logic with exponential backoff
 * @param fn - Async function to retry
 * @param retries - Number of retry attempts (default: 3)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @returns Result of the function or throws error after all retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) {
        throw error; // Last attempt, throw error
      }
      // Exponential backoff: 1s, 2s, 3s...
      const delay = baseDelay * (i + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry failed'); // Should never reach here
}

