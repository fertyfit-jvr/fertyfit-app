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

