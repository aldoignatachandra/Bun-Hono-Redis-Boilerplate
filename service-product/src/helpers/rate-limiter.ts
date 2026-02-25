type Bucket = {
  tokens: number;
  lastRefill: number;
  limit: number;
  windowMs: number;
  expiresAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  limit: number;
};

const buckets = new Map<string, Bucket>();
let lastCleanup = 0;

const cleanupBuckets = (now: number) => {
  if (now - lastCleanup < 60000) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.expiresAt <= now) {
      buckets.delete(key);
    }
  }
};

export const resetRateLimiterStore = () => {
  buckets.clear();
  lastCleanup = 0;
};

export const checkAndConsume = (
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult => {
  cleanupBuckets(now);
  const existing = buckets.get(key);
  const refillRate = limit / windowMs;

  if (!existing || existing.limit !== limit || existing.windowMs !== windowMs || existing.expiresAt <= now) {
    const bucket: Bucket = {
      tokens: limit - 1,
      lastRefill: now,
      limit,
      windowMs,
      expiresAt: now + windowMs,
    };
    buckets.set(key, bucket);
    return { allowed: true, retryAfter: 0, remaining: bucket.tokens, limit };
  }

  const elapsed = now - existing.lastRefill;
  if (elapsed > 0) {
    existing.tokens = Math.min(limit, existing.tokens + elapsed * refillRate);
    existing.lastRefill = now;
  }

  existing.expiresAt = now + windowMs;

  if (existing.tokens >= 1) {
    existing.tokens -= 1;
    return { allowed: true, retryAfter: 0, remaining: Math.floor(existing.tokens), limit };
  }

  const msUntilNext = Math.ceil((1 - existing.tokens) / refillRate);
  const retryAfter = Math.max(1, Math.ceil(msUntilNext / 1000));
  return { allowed: false, retryAfter, remaining: 0, limit };
};
