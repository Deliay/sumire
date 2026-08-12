import type { Response } from "express";
import { COOKIE_NAME, SESSION_TTL_SECONDS, config } from "../config";

const MAX_AGE = SESSION_TTL_SECONDS * 1000;

export function setSessionCookie(res: Response, sid: string): void {
  const parts = [
    `${COOKIE_NAME}=${sid}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (config.cookieSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/** 登出/失效时清除 Cookie（立即过期，保留其余属性）。 */
export function clearSessionCookie(res: Response): void {
  const parts = [
    `${COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (config.cookieSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function parseSid(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME && rest.length) return rest.join("=");
  }
  return null;
}
