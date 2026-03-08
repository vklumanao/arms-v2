/**
 * Builds an in-memory rate-limiting middleware.
 *
 * System flow:
 * - Derive request key (`keyFn` or IP fallback).
 * - Track count and window reset timestamp per key.
 * - Reject requests beyond `maxRequests` with HTTP 429.
 *
 * Important limitations:
 * - Storage is process-local (not shared across instances).
 * - Counters reset on process restart.
 */
export function createRateLimiter({ windowMs, maxRequests, keyFn }) {
  const hits = new Map();

  /**
   * Express middleware enforcing configured request limits.
   */
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip || "unknown";
    const current = hits.get(key);

    // Start a new window when key is first seen or previous window expired.
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    const remainingMs = Math.max(current.resetAt - now, 0);
    // Communicate when client can retry according to RFC-friendly semantics.
    res.setHeader("Retry-After", String(Math.ceil(remainingMs / 1000)));

    if (current.count > maxRequests) {
      return res
        .status(429)
        .json({ error: "Too many requests. Please retry later." });
    }

    return next();
  };
}
