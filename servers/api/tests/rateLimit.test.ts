import { describe, it, expect, vi } from "vitest";
import { RedisRateLimiter } from "../src/auth/rateLimit";
import { loginRateLimit } from "../src/auth/rateLimit";
import type { Request, Response } from "express";

function fakeRedis() {
  const store = new Map<string, number>();
  return {
    redis: {
      async get(key: string) {
        return store.has(key) ? String(store.get(key)) : null;
      },
      async incr(key: string) {
        const next = (store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      },
      async expire() {
        return 1;
      },
    } as never,
    store,
  };
}

describe("RedisRateLimiter 限速计数", () => {
  it("5 次失败后 isBlocked 为 true，第 6 次被拒", async () => {
    const limiter = new RedisRateLimiter(fakeRedis().redis as never);
    for (let i = 0; i < 5; i++) {
      expect(await limiter.isBlocked("1.2.3.4")).toBe(false);
      await limiter.recordFailure("1.2.3.4");
    }
    expect(await limiter.isBlocked("1.2.3.4")).toBe(true);
  });

  it("不同 IP 独立计数", async () => {
    const limiter = new RedisRateLimiter(fakeRedis().redis as never);
    for (let i = 0; i < 5; i++) await limiter.recordFailure("ip-a");
    expect(await limiter.isBlocked("ip-a")).toBe(true);
    expect(await limiter.isBlocked("ip-b")).toBe(false);
  });
});

describe("loginRateLimit 中间件", () => {
  it("已限速时返回 429", async () => {
    const limiter = new RedisRateLimiter(fakeRedis().redis as never);
    await limiter.recordFailure("9.9.9.9");
    await limiter.recordFailure("9.9.9.9");
    await limiter.recordFailure("9.9.9.9");
    await limiter.recordFailure("9.9.9.9");
    await limiter.recordFailure("9.9.9.9");
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
    let nextCalled = false;
    await mw(req, res, () => {
      nextCalled = true;
    });
    expect(status).toBe(429);
    expect(body).toEqual({ error: "尝试过于频繁，请稍后再试" });
    expect(nextCalled).toBe(false);
  });
});
