import { Router, type Request, type Response } from "express";
import {
  createStreamPlan,
  listStreamPlans,
  findStreamPlan,
} from "../db/streamPlans";
import { requireRole } from "../rbac/requireRole";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 校验 YYYY-MM-DD 且为真实存在的日期（拒绝 2026-02-30 之类）。 */
export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function createStreamPlansRouter(): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    if (from && !isValidDate(from)) {
      res.status(400).json({ error: "日期格式非法" });
      return;
    }
    if (to && !isValidDate(to)) {
      res.status(400).json({ error: "日期格式非法" });
      return;
    }
    const plans = await listStreamPlans(from, to);
    res.status(200).json({ plans });
  });

  router.post("/", requireRole("admin"), async (req: Request, res: Response) => {
    const { date, title } = req.body ?? {};
    if (typeof date !== "string" || !isValidDate(date)) {
      res.status(400).json({ error: "日期格式非法" });
      return;
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      res.status(400).json({ error: "直播主题不能为空" });
      return;
    }
    const trimmed = title.trim();
    if (trimmed.length > 50) {
      res.status(400).json({ error: "直播主题不能超过 50 字符" });
      return;
    }
    const existing = await findStreamPlan(date, trimmed);
    if (existing) {
      res.status(409).json({ error: "该日已有相同主题的直播计划" });
      return;
    }
    const created = await createStreamPlan({
      date,
      title: trimmed,
      createdBy: req.user?.username ?? "unknown",
    });
    res
      .status(201)
      .json({ ok: true, id: created.id, date: created.date, title: created.title });
  });

  return router;
}
