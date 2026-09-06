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

export class RedisReviewQueue implements ReviewQueue {
  private redis: Redis;
  private key = "marsh:ai-review";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async enqueue(job: ReviewJob): Promise<void> {
    await this.redis.lpush(this.key, JSON.stringify(job));
  }

  async dequeue(): Promise<ReviewJob | null> {
    const result = await this.redis.brpop(this.key, 5);
    if (!result) return null;
    try {
      return JSON.parse(result[1]) as ReviewJob;
    } catch {
      return null;
    }
  }

  dispose(): void {
    // 复用连接
  }
}

export class MemoryReviewQueue implements ReviewQueue {
  private queue: ReviewJob[] = [];

  async enqueue(job: ReviewJob): Promise<void> {
    this.queue.push(job);
  }

  // I23: 添加 sleep 避免忙转
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
