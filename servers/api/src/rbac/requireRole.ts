import type { NextFunction, Request, Response } from "express";
import type { Role } from "./roles";
import { atLeast } from "./roles";

export interface SessionUser {
  userId: string;
  username: string;
  role: Role;
}

/**
 * 权限中间件：要求会话角色至少达到 required 层级。
 * 未登录 401，已登录但角色不足 403。
 */
export function requireRole(required: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    if (!atLeast(user.role, required)) {
      res.status(403).json({ error: "权限不足" });
      return;
    }
    next();
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}
