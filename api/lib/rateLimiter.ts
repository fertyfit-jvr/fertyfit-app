/**
 * Rate Limiter
 * Simple in-memory rate limiter for API routes
 * For production, consider using Redis or Vercel Edge Config
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimiter {
  private store: RateLimitStore = {};
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 10) {
    this.windowMs = windowMs; // Default: 1 minute
    this.maxRequests = maxRequests; // Default: 10 requests per window
  }

  /**
   * Check if request should be allowed
   * @param identifier - Unique identifier (IP, userId, etc.)
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const record = this.store[identifier];

    // Clean expired entries periodically
    if (Math.random() < 0.01) {
      this.cleanExpired();
    }

    if (!record || now > record.resetTime) {
      // New window or expired
      this.store[identifier] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    if (record.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }

    record.count++;
    return {
      allowed: true,
      remaining: this.maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }

  private cleanExpired(): void {
    const now = Date.now();
    Object.keys(this.store).forEach((key) => {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    });
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    delete this.store[identifier];
  }
}

// Create rate limiters for different endpoints
export const geminiRateLimiter = new RateLimiter(60000, 20); // 20 requests per minute
export const ocrRateLimiter = new RateLimiter(60000, 10); // 10 requests per minute (more expensive)
export const apiRateLimiter = new RateLimiter(60000, 100); // 100 requests per minute for general API

/**
 * Get client identifier from request
 */
export function getClientIdentifier(req: any): string {
  // Try to get user ID first (if authenticated)
  if (req.body?.userId) {
    return `user:${req.body.userId}`;
  }
  
  // Fallback to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
    : req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
  
  return `ip:${ip}`;
}

/**
 * Rate limit middleware for Vercel serverless functions
 */
export function rateLimitMiddleware(
  limiter: RateLimiter,
  req: any,
  res: any
): { allowed: boolean; headers?: Record<string, string> } {
  const identifier = getClientIdentifier(req);
  const result = limiter.check(identifier);

  const headers = {
    'X-RateLimit-Limit': limiter['maxRequests'].toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  };

  if (!result.allowed) {
    return {
      allowed: false,
      headers,
    };
  }

  return {
    allowed: true,
    headers,
  };
}
