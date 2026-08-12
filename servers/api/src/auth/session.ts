import type { NextFunction, Request, Response } from "express";
import type { SessionStore } from "../session/store";
import { parseSid } from "../session/cookie";

/**
 * 会话中间件：从 Cookie 解析 sid，加载会话并挂载到 req.user，同时滑动刷新 TTL。
 * 不强制要求登录（未登录时 req.user 为 undefined）。
 */
export function sessionMiddleware(store: SessionStore) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const sid = parseSid(req.headers.cookie);
      if (sid) {
        const session = await store.get(sid);
        if (session) {
          req.user = {
            userId: session.userId,
            username: session.username,
            role: session.role,
          };
          const refreshed = { ...session, lastSeenAt: Date.now() };
          req.session = { sid, data: session };
          await store.touch(sid, refreshed);
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: { sid: string; data: import("../session/store").SessionData };
    }
  }
}
