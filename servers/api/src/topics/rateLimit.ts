import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { Redis } from "ioredis";

export interface MarshRateLimiter {
  check(key: string): Promise<boolean>;
  record(key: string): Promise<void>;
  dispose(): void;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export class RedisMarshRateLimiter implements MarshRateLimiter {
  private redis: Redis;
  constructor(redis: Redis) {
    this.redis = redis;
  }

  async check(key: string): Promise<boolean> {
    const windows = [
      { prefix: "1m", limit: 1, ttl: 60 },
      { prefix: "1h", limit: 5, ttl: 3600 },
    ];
    for (const w of windows) {
      const redisKey = `marsh:${w.prefix}:${key}`;
      const count = Number(await this.redis.get(redisKey)) || 0;
      if (count >= w.limit) return false;
    }
    return true;
  }

  async record(key: string): Promise<void> {
    const windows = [
      { prefix: "1m", ttl: 60 },
      { prefix: "1h", ttl: 3600 },
    ];
    for (const w of windows) {
      const redisKey = `marsh:${w.prefix}:${key}`;
      const count = await this.redis.incr(redisKey);
      if (count === 1) {
        await this.redis.expire(redisKey, w.ttl);
      }
    }
  }

  dispose(): void {
    // 复用连接，不做处理
  }
}

export class MemoryMarshRateLimiter implements MarshRateLimiter {
  private counts = new Map<string, { count: number; expires: number }>();

  async check(key: string): Promise<boolean> {
    const now = Date.now();
    const windows = [
      { prefix: "1m", limit: 1, ttl: 60_000 },
      { prefix: "1h", limit: 5, ttl: 3_600_000 },
    ];
    for (const w of windows) {
      const k = `${w.prefix}:${key}`;
      const entry = this.counts.get(k);
      if (entry && entry.expires > now && entry.count >= w.limit) {
        return false;
      }
    }
    return true;
  }

  async record(key: string): Promise<void> {
    const now = Date.now();
    const windows = [
      { prefix: "1m", ttl: 60_000 },
      { prefix: "1h", ttl: 3_600_000 },
    ];
    for (const w of windows) {
      const k = `${w.prefix}:${key}`;
      const entry = this.counts.get(k);
      if (entry && entry.expires > now) {
        entry.count++;
      } else {
        this.counts.set(k, { count: 1, expires: now + w.ttl });
      }
    }
  }

  dispose(): void {
    this.counts.clear();
  }
}

export function createMemoryMarshRateLimiter(): MemoryMarshRateLimiter {
  return new MemoryMarshRateLimiter();
}

function getClientKeyHash(clientKey: string): string {
  return sha256(clientKey);
}

function getVisitorIdHash(visitorId: string): string {
  return sha256(visitorId);
}

/**
 * 三维度限速中间件：clientKey + visitorId + IP
 * 任一维度超限即返回 429
 */
export function marshRateLimit(limiter: MarshRateLimiter) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { clientKey } = (req.body ?? {}) as Record<string, unknown>;
    const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
    const visitorId = req.visitorId ?? "";

    const keys: string[] = [];
    if (typeof clientKey === "string" && clientKey.trim()) {
      keys.push(`ck:${getClientKeyHash(clientKey.trim())}`);
    }
    if (visitorId) {
      keys.push(`vid:${getVisitorIdHash(visitorId)}`);
    }
    keys.push(`ip:${ip}`);

    for (const k of keys) {
      const ok = await limiter.check(k);
      if (!ok) {
        res.status(429).json({ error: "操作频率过快" });
        return;
      }
    }

    for (const k of keys) {
      await limiter.record(k);
    }

    next();
  };
}
