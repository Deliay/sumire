import { Redis } from "ioredis";
import type { NextFunction, Request, Response } from "express";
import { LOGIN_RATE_LIMIT } from "../config";

const WINDOW_SECONDS = 60;

export interface RateLimiter {
  /** 是否已触发限速（当前失败计数 >= 阈值） */
  isBlocked(ip: string): Promise<boolean>;
  /** 记录一次失败 */
  recordFailure(ip: string): Promise<void>;
  dispose(): void;
}

export class RedisRateLimiter implements RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async isBlocked(ip: string): Promise<boolean> {
    const count = Number(await this.redis.get(`login:${ip}`)) || 0;
    return count >= LOGIN_RATE_LIMIT;
  }

  async recordFailure(ip: string): Promise<void> {
    const key = `login:${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, WINDOW_SECONDS);
    }
  }

  dispose(): void {
    // 复用连接，不做处理
  }
}

export function loginRateLimit(limiter: RateLimiter) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const blocked = await limiter.isBlocked(ip);
    if (blocked) {
      res.status(429).json({ error: "尝试过于频繁，请稍后再试" });
      return;
    }
    next();
  };
}
