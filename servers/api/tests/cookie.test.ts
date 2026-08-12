import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setSessionCookie, clearSessionCookie, parseSid } from "../src/session/cookie";
import type { Response } from "express";
import { config } from "../src/config";

function mockRes(): { headers: Record<string, string> } & Response {
  const res = { headers: {} } as unknown as { headers: Record<string, string> } & Response;
  res.setHeader = (name: string, value: string) => {
    res.headers[name] = value;
    return res;
  };
  return res;
}

describe("setSessionCookie", () => {
  it("包含 HttpOnly/Path=/SameSite=Lax/Max-Age=604800，不含 Domain", () => {
    const res = mockRes();
    setSessionCookie(res, "abc123");
    const cookie = res.headers["Set-Cookie"];
    expect(cookie).toContain("sumire_sid=abc123");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=604800");
    expect(cookie).not.toContain("Domain");
  });

  it("生产环境含 Secure", () => {
    const prev = config.cookieSecure;
    config.cookieSecure = true;
    const res = mockRes();
    setSessionCookie(res, "abc");
    expect(res.headers["Set-Cookie"]).toContain("Secure");
    config.cookieSecure = prev;
  });
});

describe("clearSessionCookie", () => {
  it("立即过期", () => {
    const res = mockRes();
    clearSessionCookie(res);
    expect(res.headers["Set-Cookie"]).toContain("Max-Age=0");
    expect(res.headers["Set-Cookie"]).toContain("sumire_sid=");
  });
});

describe("parseSid", () => {
  it("从 Cookie 头解析 sumire_sid", () => {
    expect(parseSid("other=1; sumire_sid=xyz; a=b")).toBe("xyz");
  });

  it("无 Cookie 或未含 sid 返回 null", () => {
    expect(parseSid(undefined)).toBeNull();
    expect(parseSid("other=1")).toBeNull();
  });
});

beforeEach(() => {
  config.cookieSecure = false;
});
afterEach(() => {
  config.cookieSecure = false;
});
