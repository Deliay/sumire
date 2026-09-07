import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";

const COOKIE_NAME = "sumire_vid";
const MAX_AGE = 365 * 24 * 60 * 60; // 1 年

declare global {
  namespace Express {
    interface Request {
      visitorId?: string;
    }
  }
}

function parseVisitorId(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE_NAME && rest.length) return rest.join("=");
  }
  return null;
}

function setVisitorCookie(res: Response, vid: string): void {
  const parts = [
    `${COOKIE_NAME}=${vid}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`,
  ];
  if (config.cookieSecure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

/**
 * 访客 Cookie 中间件：
 * - 缺失/非法值时颁发新 visitorId
 * - 合法值透传
 */
export function visitorCookieMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const existing = parseVisitorId(req.headers.cookie);
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) {
    req.visitorId = existing;
    next();
    return;
  }
  const vid = crypto.randomUUID();
  req.visitorId = vid;
  setVisitorCookie(res, vid);
  next();
}
