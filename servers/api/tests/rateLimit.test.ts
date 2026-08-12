import { describe, it, expect, vi } from "vitest";
import { RedisRateLimiter } from "../src/auth/rateLimit";
import { loginRateLimit } from "../src/auth/rateLimit";
import type { Request, Response } from "express";

function fakeRedis() {
  const store = new Map<string, number>();
  const expire = vi.fn();
  return {
    redis: {
      async incr(key: string) {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      },
      expire,
    } as unknown as Parameters<typeof RedisRateLimiter.prototype.allow>[0] extends never ? never : never,
    store,
    expire,
  };
}

describe("RedisRateLimiter.allow 限速计数", () => {
  it("前 5 次放行，第 6 次拒绝", async () => {
    const redis = new RedisRateLimiter(fakeRedis().redis as never);
    for (let i = 1; i <= 5; i++) {
      expect(await redis.allow("1.2.3.4")).toBe(true);
    }
    expect(await redis.allow("1.2.3.4")).toBe(false);
  });

  it("不同 IP 独立计数", async () => {
    const redis = new RedisRateLimiter(fakeRedis().redis as never);
    for (let i = 1; i <= 5; i++) {
      await redis.allow("ip-a");
    }
    expect(await redis.allow("ip-b")).toBe(true);
  });
});

describe("loginRateLimit 中间件", () => {
  it("超限返回 429", async () => {
    const limiter = new RedisRateLimiter(fakeRedis().redis as never);
    const mw = loginRateLimit(limiter);
    let status = 0;
    let body: unknown;
    const req = { ip: "9.9.9.9" } as unknown as Request;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(b: unknown) {
        body = b;
        return this;
      },
    } as unknown as Response;
    for (let i = 1; i <= 5; i++) await mw(req, res, () => {});
    await mw(req, res, () => {});
    expect(status).toBe(429);
    expect(body).toEqual({ error: "尝试过于频繁，请稍后再试" });
  });
});
