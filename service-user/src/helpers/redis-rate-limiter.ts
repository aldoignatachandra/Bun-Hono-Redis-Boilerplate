import type { Redis } from 'ioredis';

type RateLimitResult = {
  allowed: boolean;
  retryAfter: number;
  remaining: number;
  limit: number;
};

const LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local current = redis.call("INCR", key)
if current == 1 then
  redis.call("EXPIRE", key, window)
end
if current > limit then
  local ttl = redis.call("TTL", key)
  return {0, ttl, current}
else
  return {1, 0, current}
end
`;

export class RedisRateLimiter {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const result = await this.redis.eval(LUA_SCRIPT, 1, key, limit, windowSeconds);
    const [allowed, ttl, current] = result as [number, number, number];
    const remaining = Math.max(0, limit - current);
    const retryAfter = allowed === 1 ? 0 : Math.max(1, Number(ttl) || 1);
    return {
      allowed: allowed === 1,
      retryAfter,
      remaining,
      limit,
    };
  }
}
