import { Router, type Request, type Response } from "express";
import { findUserByUsername, createUser, listUsers } from "../db/users";
import { hashPassword, validateStrength } from "../auth/password";
import { isRole, canCreate } from "../rbac/roles";

export function createUsersRouter(): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    if (req.user.role !== "superadmin") {
      res.status(403).json({ error: "权限不足" });
      return;
    }
    const users = await listUsers();
    res.status(200).json({ users });
  });

  router.post("/", async (req: Request, res: Response) => {
    if (!req.user) {
      res.status(401).json({ error: "未登录或会话已失效" });
      return;
    }
    const creatorRole = req.user.role;
    const { username, password, role } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string" || !isRole(role)) {
      res.status(400).json({ error: "参数不合法" });
      return;
    }
    if (!canCreate(creatorRole, role)) {
      res.status(403).json({ error: "没有创建该角色的权限" });
      return;
    }
    const strength = validateStrength(password);
    if (!strength.ok) {
      res.status(400).json({ error: strength.errors.join("；") });
      return;
    }
    if (!username.trim()) {
      res.status(400).json({ error: "用户名不能为空" });
      return;
    }
    const existing = await findUserByUsername(username.trim());
    if (existing) {
      res.status(409).json({ error: "用户名已存在" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const created = await createUser({ username: username.trim(), passwordHash, role });
    res.status(201).json({ ok: true, username: created.username, role: created.role });
  });

  return router;
}
