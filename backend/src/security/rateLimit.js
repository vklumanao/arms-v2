export function createRateLimiter({ windowMs, maxRequests, keyFn }) {
  const hits = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = keyFn ? keyFn(req) : req.ip || "unknown";
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    const remainingMs = Math.max(current.resetAt - now, 0);
    res.setHeader("Retry-After", String(Math.ceil(remainingMs / 1000)));

    if (current.count > maxRequests) {
      return res
        .status(429)
        .json({ error: "Too many requests. Please retry later." });
    }

    return next();
  };
}
