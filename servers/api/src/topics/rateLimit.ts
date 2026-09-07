import crypto from "node:crypto";
import type { Redis } from "ioredis";

export interface MarshRateLimiter {
  /**
   * 检查 key 是否被限速（不递增计数）。
   * 返回 true = 允许，false = 已超限。
   */
  check(key: string): Promise<boolean>;
  /**
   * 记录一次请求（递增计数）。
   * 应在 check 全部通过后调用。
   */
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

  // #6: check 不递增计数，仅读取当前值判断
  async check(key: string): Promise<boolean> {
    const windows = [
      { prefix: "1m", limit: 1, ttl: 60 },
      { prefix: "1h", limit: 5, ttl: 3600 },
    ];
    for (const w of windows) {
      const redisKey = `marsh:${w.prefix}:${key}`;
      const count = Number(await this.redis.get(redisKey)) || 0;
      if (count >= w.limit) {
        return false;
      }
    }
    return true;
  }

  // #6: record 原子递增所有窗口
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
