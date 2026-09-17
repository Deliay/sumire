import type { Redis } from "ioredis";

/** 录播回放事件的缓存抽象：仅 get/set 两方法，单测用内存 stub，生产用 Redis 实现。 */
export interface LiveEventsReplayCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/** Redis 实现的缓存（复用 index.ts 既有 ioredis 实例，不新建连接）。 */
export class RedisLiveEventsReplayCache implements LiveEventsReplayCache {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, "EX", ttlSeconds);
  }
}

/** 进程内内存缓存（createApp 未显式注入缓存时的缺省实现，仅测试/兜底用）。 */
export function createMemoryLiveEventsReplayCache(): LiveEventsReplayCache {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async set(key, value) {
      map.set(key, value);
    },
  };
}
