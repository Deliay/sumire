import { Router, type Request, type Response } from "express";
import type { SessionStore } from "../session/store";
import { setSessionCookie, clearSessionCookie } from "../session/cookie";
import { findUserByUsername, updateUserPassword } from "../db/users";
import { verifyPassword, validateStrength, hashPassword } from "../auth/password";
import type { RateLimiter } from "../auth/rateLimit";
import { loginRateLimit } from "../auth/rateLimit";

export function createAuthRouter(store: SessionStore, rateLimiter: RateLimiter): Router {
  const router = Router();

  router.post("/login", loginRateLimit(rateLimiter), async (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "缺少用户名或密码" });
      return;
    }
    const user = await findUserByUsername(username);
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      res.status(401).json({ error: "账号或密码错误" });
      return;
    }
    const now = Date.now();
    const sid = await store.create({
      userId: user._id.toString(),
      username: user.username,
      role: user.role,
      createdAt: now,
      lastSeenAt: now,
    });
    setSessionCookie(res, sid);
    res.status(200).json({
      ok: true,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  });

  router.post("/logout", async (req: Request, res: Response) => {
    if (req.session?.sid) {
      await store.destroy(req.session.sid);
    }
    clearSessionCookie(res);
    res.status(200).json({ ok: true });
  });

  router.get("/me", async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    // 强制改密标记以数据库为准（改密成功后置 false）
    const user = await findUserByUsername(req.user.username);
    if (!user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    res.status(200).json({
      ok: true,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  });

  router.post("/change-password", async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    const { oldPassword, newPassword } = req.body ?? {};
    if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
      res.status(400).json({ error: "缺少参数" });
      return;
    }
    const user = await findUserByUsername(req.user.username);
    if (!user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    const oldOk = await verifyPassword(oldPassword, user.passwordHash);
    if (!oldOk) {
      res.status(401).json({ error: "原密码错误" });
      return;
    }
    if (newPassword === oldPassword) {
      res.status(400).json({ error: "新密码不能与原密码相同" });
      return;
    }
    const strength = validateStrength(newPassword);
    if (!strength.ok) {
      res.status(400).json({ error: strength.errors.join("；") });
      return;
    }
    const newHash = await hashPassword(newPassword);
    await updateUserPassword(req.user.username, newHash);
    res.status(200).json({ ok: true });
  });

  return router;
}
