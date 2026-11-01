import { isIP } from "node:net";
import type { Request } from "express";

/**
 * 客户端 IP 候选请求头，按优先级从高到低排列。
 * 反代/网关可能只透传其中某一种，故逐个尝试，取第一个合法 IP。
 */
const CLIENT_IP_HEADERS = [
  "x-req-real-ip",
  "x-real-ip",
  "x-client-ip",
  "true-client-ip",
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-forwarded-by",
] as const;

/** 提取并校验请求头中的 IP（兼容逗号链、引号、IPv4 端口与 IPv6 方括号写法）。 */
function normalizeIp(raw: string | string[] | undefined): string | undefined {
  if (!raw) return undefined;
  const value = Array.isArray(raw) ? raw.join(",") : raw;
  const first = value
    .split(",")[0]
    ?.trim()
    .replace(/^"(.*)"$/, "$1");
  if (!first) return undefined;

  const candidate = first
    .replace(/^\[([^\]]+)\](?::\d+)?$/, "$1")
    .replace(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/, "$1");

  return isIP(candidate) ? candidate : undefined;
}

/**
 * 解析客户端真实 IP：优先取常见反代请求头，再回退 Express 的 `req.ip` / socket 地址。
 * 仅接受合法 IP，避免把伪造或非 IP 字符串写入审计字段。
 */
export function resolveClientIp(req: Request): string {
  for (const name of CLIENT_IP_HEADERS) {
    const ip = normalizeIp(req.headers[name]);
    if (ip) return ip;
  }
  const fallback = req.ip ?? req.socket?.remoteAddress;
  return normalizeIp(fallback) ?? fallback ?? "unknown";
}
