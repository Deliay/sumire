import { Redis } from "ioredis";
import type { Role } from "../rbac/roles";
import { SESSION_TTL_SECONDS } from "../config";

export interface SessionData {
  userId: string;
  username: string;
  role: Role;
  createdAt: number;
  lastSeenAt: number;
}

export interface SessionStore {
  create(data: SessionData): Promise<string>;
  get(sid: string): Promise<SessionData | null>;
  /** 校验通过时滑动刷新 TTL */
  touch(sid: string, data: SessionData): Promise<void>;
  destroy(sid: string): Promise<void>;
}

export class RedisSessionStore implements SessionStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private key(sid: string): string {
    return `session:${sid}`;
  }

  async create(data: SessionData): Promise<string> {
    const sid = crypto.randomUUID();
    await this.redis.set(
      this.key(sid),
      JSON.stringify(data),
      "EX",
      SESSION_TTL_SECONDS,
    );
    return sid;
  }

  async get(sid: string): Promise<SessionData | null> {
    const raw = await this.redis.get(this.key(sid));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as SessionData;
    } catch {
      return null;
    }
  }

  async touch(sid: string, data: SessionData): Promise<void> {
    await this.redis.set(
      this.key(sid),
      JSON.stringify(data),
      "EX",
      SESSION_TTL_SECONDS,
    );
  }

  async destroy(sid: string): Promise<void> {
    await this.redis.del(this.key(sid));
  }
}
