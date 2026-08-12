import { beforeAll, describe, expect, it } from "vitest";
import { login, CookieJar, waitForReady } from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

/**
 * 登录限速用例：同 IP 1 分钟内连续 6 次错误登录，前 5 次 401、第 6 次 429。
 * 该用例会触发 Redis 限速计数，须在其它用例之后执行，故单独成文件并以 zz- 前缀排序在最后。
 * 文件并行已关闭（fileParallelism:false）。用唯一 X-Forwarded-For 模拟独立 IP，避免受其它用例失败计数影响。
 */
describe("login rate limit", () => {
  it("login-rate-limit: 前 5 次 401、第 6 次 429", async () => {
    const uniqueIp = `10.0.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
    const attempts: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await login("supersumire", "wrong-password", new CookieJar(), {
        "X-Forwarded-For": uniqueIp,
      });
      attempts.push(res.status);
    }
    expect(attempts.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(attempts[5]).toBe(429);
  });
});
