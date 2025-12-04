/**
 * Security Headers and Utilities
 * Centralized security configuration
 */

/**
 * Security headers for API responses
 */
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Vite in dev
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co",
    "media-src 'self' blob: data:",
    "frame-ancestors 'none'",
  ].join('; '),
};

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(res: any): void {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });
}

/**
 * Validate and sanitize file upload
 */
export function validateImageUpload(base64: string, maxSizeKB: number = 5000): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  // Check format
  const imageRegex = /^data:image\/(jpeg|jpg|png|webp);base64,/;
  if (!imageRegex.test(base64)) {
    return {
      valid: false,
      error: 'Formato de imagen no soportado. Use JPEG, PNG o WebP.',
    };
  }

  // Check size (approximate)
  const base64Data = base64.split(',')[1];
  const sizeInBytes = (base64Data.length * 3) / 4;
  const sizeInKB = sizeInBytes / 1024;

  if (sizeInKB > maxSizeKB) {
    return {
      valid: false,
      error: `La imagen es demasiado grande. Máximo: ${maxSizeKB}KB`,
    };
  }

  // Basic sanitization - remove any potential script tags in metadata
  const sanitized = base64.replace(/<script/gi, '').replace(/javascript:/gi, '');

  return {
    valid: true,
    sanitized,
  };
}

/**
 * Validate CORS origin
 */
export function isValidOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  
  const allowedOrigins = [
    'https://fertyfit.com',
    'https://www.fertyfit.com',
    'https://fertyfit.vercel.app',
    'http://localhost:5173',
    'http://localhost:5174',
  ];

  return allowedOrigins.includes(origin);
}
