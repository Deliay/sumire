import type { Redis } from "ioredis";

export interface ReviewJob {
  marshmallowId: string;
  topicId: string;
}

export interface ReviewQueue {
  enqueue(job: ReviewJob): Promise<void>;
  dequeue(): Promise<ReviewJob | null>;
  dispose(): void;
}

/**
 * Redis 实现的审核队列。
 * #1: dequeue 使用独立连接（duplicate）避免 BRPOP 阻塞共享连接。
 */
export class RedisReviewQueue implements ReviewQueue {
  private redis: Redis;
  /** 独立连接用于 BRPOP 阻塞消费，不阻塞主连接上的其它命令 */
  private consumerRedis: Redis;
  private key = "marsh:ai-review";

  constructor(redis: Redis) {
    this.redis = redis;
    this.consumerRedis = redis.duplicate();
  }

  async enqueue(job: ReviewJob): Promise<void> {
    await this.redis.lpush(this.key, JSON.stringify(job));
  }

  async dequeue(): Promise<ReviewJob | null> {
    // #1: 使用独立连接执行 BRPOP，避免阻塞主连接
    const result = await this.consumerRedis.brpop(this.key, 5);
    if (!result) return null;
    try {
      return JSON.parse(result[1]) as ReviewJob;
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.consumerRedis.disconnect();
  }
}

export class MemoryReviewQueue implements ReviewQueue {
  private queue: ReviewJob[] = [];

  async enqueue(job: ReviewJob): Promise<void> {
    this.queue.push(job);
  }

  async dequeue(): Promise<ReviewJob | null> {
    const job = this.queue.shift() ?? null;
    if (!job) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return job;
  }

  dispose(): void {
    this.queue = [];
  }
}
