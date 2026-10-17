import { Redis } from "ioredis";
import type { NextFunction, Request, Response } from "express";

export const redis = new Redis(
  process.env.REDIS_URL ?? "redis://localhost:6379",
  {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy: (attempt: number) => (attempt <= 2 ? 250 : null),
  },
);

const incrementScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {count, ttl}
`;

export type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

type RedisRateLimitClient = {
  status: string;
  connect: () => Promise<unknown>;
  eval: (
    script: string,
    numberOfKeys: number,
    key: string,
    windowMs: string,
  ) => Promise<unknown>;
};

export function rateLimit(
  options: RateLimitOptions,
  client: RedisRateLimitClient = redis,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const clientIp = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${options.keyPrefix}:${clientIp}`;

    try {
      if (client.status === "wait") {
        await client.connect();
      }

      const result = (await client.eval(
        incrementScript,
        1,
        key,
        String(options.windowMs),
      )) as [number | string, number | string];

      const count = Number(result[0]);
      const ttlMs = Math.max(1, Number(result[1]));
      const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));

      res.setHeader("RateLimit-Limit", options.max);
      res.setHeader("RateLimit-Remaining", Math.max(0, options.max - count));
      res.setHeader("RateLimit-Reset", Math.ceil(Date.now() / 1000) + retryAfter);

      if (count > options.max) {
        res.setHeader("Retry-After", retryAfter);
        res.status(429).json({
          error: "Too many requests. Please try again later.",
          retryAfter,
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Rate limiter Redis error:", error);
      res.status(503).json({
        error: "Rate limiting is temporarily unavailable. Please try again.",
      });
    }
  };
}
