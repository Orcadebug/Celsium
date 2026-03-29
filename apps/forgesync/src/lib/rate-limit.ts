// Simple in-memory rate limiter using sliding window.
// For production at scale, replace with Redis-based (e.g., @upstash/ratelimit).

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

const store = new Map<string, number[]>();

// Periodically clean up expired entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60_000;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of store) {
      const filtered = timestamps.filter((t) => now - t < windowMs);
      if (filtered.length === 0) {
        store.delete(key);
      } else {
        store.set(key, filtered);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the process to exit without waiting for the timer
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  ensureCleanup(config.windowMs);

  const now = Date.now();
  const windowStart = now - config.windowMs;

  const timestamps = store.get(identifier) ?? [];
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= config.maxRequests) {
    const oldestInWindow = activeTimestamps[0]!;
    const resetAt = oldestInWindow + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
    };
  }

  activeTimestamps.push(now);
  store.set(identifier, activeTimestamps);

  return {
    allowed: true,
    remaining: config.maxRequests - activeTimestamps.length,
    resetAt: now + config.windowMs,
  };
}

/** 100 requests per 60 seconds — general agent API endpoints */
export const API_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 100,
};

/** 10 requests per 60 seconds — login / token endpoints */
export const AUTH_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 10,
};

/** 5 requests per 60 seconds — internal / admin endpoints */
export const INTERNAL_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 5,
};
