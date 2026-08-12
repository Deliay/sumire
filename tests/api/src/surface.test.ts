import { beforeAll, describe, expect, it } from "vitest";
import { request, waitForReady, bookstoreOrigin } from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

describe("api-only surface", () => {
  it("api-only-surface: GET /、/backdoor、/backdoor/login 一律 404；/api/auth/me 可达（401 而非 404）", async () => {
    for (const path of ["/", "/backdoor", "/backdoor/login"]) {
      const res = await request(path);
      expect(res.status).toBe(404);
    }
    const me = await request("/api/auth/me");
    expect(me.status).toBe(401);
  });
});

describe("cors", () => {
  it("cors-credentials: 白名单 Origin 预检返回精确 Allow-Origin（非*）+ Allow-Credentials: true", async () => {
    if (!bookstoreOrigin) {
      console.warn("未注入 BOOKSTORE_ORIGIN，跳过 CORS 预检用例");
      return;
    }
    const res = await request("/api/auth/login", {
      method: "OPTIONS",
      origin: bookstoreOrigin,
    });
    const allowOrigin = res.headers.get("access-control-allow-origin");
    expect(allowOrigin).toBe(bookstoreOrigin);
    expect(allowOrigin).not.toBe("*");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("cors-credentials: 非白名单 Origin 预检无 CORS 头", async () => {
    const res = await request("/api/auth/login", {
      method: "OPTIONS",
      origin: "http://evil.example.com",
    });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });
});
