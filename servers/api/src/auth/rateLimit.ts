import { Redis } from "ioredis";
import type { NextFunction, Request, Response } from "express";
import { LOGIN_RATE_LIMIT } from "../config";

const WINDOW_SECONDS = 60;

export interface RateLimiter {
  allow(ip: string): Promise<boolean>;
  dispose(): void;
}

export class RedisRateLimiter implements RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async allow(ip: string): Promise<boolean> {
    const key = `login:${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }
    return count <= LOGIN_RATE_LIMIT;
  }

  dispose(): void {
    // 复用连接，不做处理
  }
}

export function loginRateLimit(limiter: RateLimiter) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const allowed = await limiter.allow(ip);
    if (!allowed) {
      res.status(429).json({ error: "尝试过于频繁，请稍后再试" });
      return;
    }
    next();
  };
}
