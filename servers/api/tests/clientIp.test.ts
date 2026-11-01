import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { resolveClientIp } from "../src/infra/clientIp";

function req(
  headers: Record<string, string | string[]>,
  ip?: string,
  remoteAddress?: string,
): Request {
  return { headers, ip, socket: { remoteAddress } } as unknown as Request;
}

describe("resolveClientIp", () => {
  it("优先取 X-Req-Real-IP", () => {
    const r = req(
      {
        "x-real-ip": "10.0.0.2",
        "x-req-real-ip": "203.0.113.10",
        "x-forwarded-for": "198.51.100.1, 10.0.0.3",
      },
      "127.0.0.1",
    );
    expect(resolveClientIp(r)).toBe("203.0.113.10");
  });

  it("X-Real-IP 次之", () => {
    const r = req({ "x-real-ip": "203.0.113.11" }, "127.0.0.1");
    expect(resolveClientIp(r)).toBe("203.0.113.11");
  });

  it("解析 X-Forwarded-For 逗号链的首个地址", () => {
    const r = req({ "x-forwarded-for": "203.0.113.12, 10.0.0.1, 10.0.0.2" }, "127.0.0.1");
    expect(resolveClientIp(r)).toBe("203.0.113.12");
  });

  it("支持 X-Forwarded-By", () => {
    const r = req({ "x-forwarded-by": "203.0.113.13" }, "127.0.0.1");
    expect(resolveClientIp(r)).toBe("203.0.113.13");
  });

  it("去除 IPv4 端口与 IPv6 方括号端口", () => {
    expect(
      resolveClientIp(req({ "x-real-ip": "203.0.113.14:8080" }, "127.0.0.1")),
    ).toBe("203.0.113.14");
    expect(
      resolveClientIp(req({ "x-real-ip": "[2001:db8::1]:8080" }, "127.0.0.1")),
    ).toBe("2001:db8::1");
  });

  it("忽略非法请求头并回退 req.ip", () => {
    const r = req({ "x-req-real-ip": "unknown", "x-real-ip": "not-an-ip" }, "203.0.113.15");
    expect(resolveClientIp(r)).toBe("203.0.113.15");
  });

  it("回退到 socket.remoteAddress", () => {
    const r = req({}, undefined, "203.0.113.16");
    expect(resolveClientIp(r)).toBe("203.0.113.16");
  });

  it("全部缺失时返回 unknown", () => {
    expect(resolveClientIp(req({}))).toBe("unknown");
  });
});
