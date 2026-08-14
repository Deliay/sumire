import { Router, type Request, type Response } from "express";
import { isValidObjectId } from "mongoose";
import {
  createStreamPlan,
  listStreamPlans,
  findStreamPlan,
  updateStreamPlan,
  deleteStreamPlan,
} from "../db/streamPlans";
import { requireRole } from "../rbac/requireRole";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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

/** 校验 HH:mm 且为真实时间（00:00–23:59，分钟 00–59）。 */
export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** 统一解析并校验三字段（date / startTime / title）。返回 { ok, data?, error? }。 */
function parseFields(body: unknown): {
  ok: boolean;
  data?: { date: string; startTime: string; title: string };
  error?: string;
} {
  const { date, startTime, title } = (body ?? {}) as Record<string, unknown>;
  if (typeof date !== "string" || !isValidDate(date)) {
    return { ok: false, error: "日期格式非法" };
  }
  if (typeof startTime !== "string" || !isValidTime(startTime)) {
    return { ok: false, error: "开始时间格式非法" };
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return { ok: false, error: "直播主题不能为空" };
  }
  const trimmed = title.trim();
  if (trimmed.length > 50) {
    return { ok: false, error: "直播主题不能超过 50 字符" };
  }
  return { ok: true, data: { date, startTime, title: trimmed } };
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
    const parsed = parseFields(req.body);
    if (!parsed.ok || !parsed.data) {
      res.status(400).json({ error: parsed.error ?? "参数不合法" });
      return;
    }
    const { date, startTime, title } = parsed.data;
    const existing = await findStreamPlan(date, startTime, title);
    if (existing) {
      res.status(409).json({ error: "该日该时间已有相同主题的直播计划" });
      return;
    }
    const created = await createStreamPlan({
      date,
      startTime,
      title,
      createdBy: req.user?.username ?? "unknown",
    });
    res.status(201).json({
      ok: true,
      id: created.id,
      date: created.date,
      startTime: created.startTime,
      title: created.title,
    });
  });

  router.put("/:id", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "计划 ID 非法" });
      return;
    }
    const parsed = parseFields(req.body);
    if (!parsed.ok || !parsed.data) {
      res.status(400).json({ error: parsed.error ?? "参数不合法" });
      return;
    }
    const { date, startTime, title } = parsed.data;
    const conflicting = await findStreamPlan(date, startTime, title, id);
    if (conflicting) {
      res.status(409).json({ error: "该日该时间已有相同主题的直播计划" });
      return;
    }
    const updated = await updateStreamPlan(id, { date, startTime, title });
    if (!updated) {
      res.status(404).json({ error: "直播计划不存在" });
      return;
    }
    res.status(200).json({
      ok: true,
      id: updated.id,
      date: updated.date,
      startTime: updated.startTime,
      title: updated.title,
    });
  });

  router.delete("/:id", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "计划 ID 非法" });
      return;
    }
    const deleted = await deleteStreamPlan(id);
    if (!deleted) {
      res.status(404).json({ error: "直播计划不存在" });
      return;
    }
    res.status(200).json({ ok: true });
  });

  return router;
}
