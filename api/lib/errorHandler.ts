/**
 * Error Handler
 * Centralized error handling with proper logging and user-friendly messages
 */

const isProduction = process.env.NODE_ENV === 'production';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  isOperational?: boolean;
}

/**
 * Create a standardized error
 */
export function createError(
  message: string,
  statusCode: number = 500,
  code?: string,
  isOperational: boolean = true
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.isOperational = isOperational;
  return error;
}

/**
 * Handle errors and return user-friendly responses
 */
export function handleError(error: unknown, req?: any): {
  statusCode: number;
  message: string;
  code?: string;
  details?: any;
} {
  // Log error details (only in development or to logging service)
  if (!isProduction) {
    console.error('Error details:', error);
  }

  // Handle known error types
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const appError = error as AppError;
    return {
      statusCode: appError.statusCode || 500,
      message: appError.message || 'Ha ocurrido un error',
      code: appError.code,
      details: isProduction ? undefined : { stack: error instanceof Error ? error.stack : undefined },
    };
  }

  // Handle Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: string[]; message: string }> };
    const firstIssue = zodError.issues[0];
    return {
      statusCode: 400,
      message: `Error de validación: ${firstIssue.message}`,
      code: 'VALIDATION_ERROR',
      details: isProduction ? undefined : { issues: zodError.issues },
    };
  }

  // Handle Supabase errors
  if (error && typeof error === 'object' && 'code' in error) {
    const supabaseError = error as { code: string; message: string };
    return {
      statusCode: 400,
      message: 'Error en la base de datos',
      code: supabaseError.code,
      details: isProduction ? undefined : { message: supabaseError.message },
    };
  }

  // Generic error
  return {
    statusCode: 500,
    message: isProduction 
      ? 'Ha ocurrido un error. Por favor, intenta de nuevo más tarde.'
      : (error instanceof Error ? error.message : 'Error desconocido'),
    code: 'INTERNAL_ERROR',
    details: isProduction ? undefined : {
      error: error instanceof Error ? error.stack : String(error),
    },
  };
}

/**
 * Safe error response for API routes
 */
export function sendErrorResponse(res: any, error: unknown, req?: any): void {
  const errorResponse = handleError(error, req);
  
  // Set headers
  if (errorResponse.code === 'RATE_LIMIT_EXCEEDED') {
    res.setHeader('Retry-After', '60');
  }

  res.status(errorResponse.statusCode).json({
    error: errorResponse.message,
    code: errorResponse.code,
    ...(errorResponse.details && { details: errorResponse.details }),
  });
}
