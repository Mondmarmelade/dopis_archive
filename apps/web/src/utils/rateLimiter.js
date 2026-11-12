/**
 * In-memory rate limiter for authentication endpoints.
 * Automatically evicts stale buckets to avoid memory leaks.
 */

const buckets = new Map();

export function getClientIp(request) {
  if (!request || !request.headers) return "unknown-ip";
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }
  return "direct-client";
}

export function checkRateLimit(key, options = {}) {
  const maxAttempts = options.maxAttempts || 10;
  const windowMs = options.windowMs || 5 * 60 * 1000; // 5 minutes
  const now = Date.now();

  const record = buckets.get(key);
  if (!record || now > record.resetTime) {
    return {
      allowed: true,
      remaining: maxAttempts,
      resetInSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxAttempts) {
    const resetInSeconds = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetInSeconds: Math.ceil((record.resetTime - now) / 1000),
  };
}

export function recordFailedAttempt(key, options = {}) {
  const windowMs = options.windowMs || 5 * 60 * 1000;
  const now = Date.now();

  let record = buckets.get(key);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + windowMs };
    buckets.set(key, record);
  } else {
    record.count += 1;
  }

  // Periodic cleanup if map grows too large
  if (buckets.size > 10000) {
    for (const [k, v] of buckets.entries()) {
      if (now > v.resetTime) {
        buckets.delete(k);
      }
    }
  }
}

export function clearRateLimit(key) {
  buckets.delete(key);
}
