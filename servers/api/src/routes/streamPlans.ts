import { Router, type Request, type Response } from "express";
import { isValidObjectId } from "mongoose";
import {
  type TimeType,
  createStreamPlan,
  listStreamPlans,
  findStreamPlan,
  updateStreamPlan,
  deleteStreamPlan,
} from "../db/streamPlans";
import { requireRole } from "../rbac/requireRole";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_TIME_TYPES = ["fixed", "tbd", "allDay"] as const;

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

/** 统一解析并校验字段（date / timeType / startTime / title）。返回 { ok, data?, error? }。 */
function parseFields(body: unknown): {
  ok: boolean;
  data?: { date: string; timeType: TimeType; startTime: string | null; title: string };
  error?: string;
} {
  const { date, timeType: rawTimeType, startTime: rawStartTime, title } = (body ?? {}) as Record<string, unknown>;
  
  if (typeof date !== "string" || !isValidDate(date)) {
    return { ok: false, error: "日期格式非法" };
  }
  
  // timeType 缺省 fixed
  const timeType: TimeType = (typeof rawTimeType === "string" && VALID_TIME_TYPES.includes(rawTimeType as TimeType))
    ? (rawTimeType as TimeType)
    : "fixed";
  
  if (!VALID_TIME_TYPES.includes(timeType)) {
    return { ok: false, error: "日程类型非法" };
  }
  
  // startTime 校验：fixed 时必填且合法，tbd/allDay 时必须为空
  if (timeType === "fixed") {
    if (typeof rawStartTime !== "string" || !isValidTime(rawStartTime)) {
      return { ok: false, error: "开始时间格式非法" };
    }
    const startTime = rawStartTime;
    if (typeof title !== "string" || title.trim().length === 0) {
      return { ok: false, error: "直播主题不能为空" };
    }
    const trimmed = title.trim();
    if (trimmed.length > 50) {
      return { ok: false, error: "直播主题不能超过 50 字符" };
    }
    return { ok: true, data: { date, timeType, startTime, title: trimmed } };
  } else {
    // tbd/allDay：startTime 必须为空
    const hasStartTime = rawStartTime !== null && rawStartTime !== undefined && rawStartTime !== "";
    if (hasStartTime) {
      const errorMsg = timeType === "tbd" ? "时间待定日程无需填写开始时间" : "全天日程无需填写开始时间";
      return { ok: false, error: errorMsg };
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      return { ok: false, error: "直播主题不能为空" };
    }
    const trimmed = title.trim();
    if (trimmed.length > 50) {
      return { ok: false, error: "直播主题不能超过 50 字符" };
    }
    return { ok: true, data: { date, timeType, startTime: null, title: trimmed } };
  }
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
    const { date, timeType, startTime, title } = parsed.data;
    const existing = await findStreamPlan(date, timeType, startTime, title);
    if (existing) {
      const errorMsg = timeType === "fixed"
        ? "该日该时间已有相同主题的直播计划"
        : "该日已有相同主题的同类型日程";
      res.status(409).json({ error: errorMsg });
      return;
    }
    const created = await createStreamPlan({
      date,
      timeType,
      startTime,
      title,
      createdBy: req.user?.username ?? "unknown",
    });
    res.status(201).json({
      ok: true,
      id: created.id,
      date: created.date,
      timeType: created.timeType,
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
    const { date, timeType, startTime, title } = parsed.data;
    const conflicting = await findStreamPlan(date, timeType, startTime, title, id);
    if (conflicting) {
      const errorMsg = timeType === "fixed"
        ? "该日该时间已有相同主题的直播计划"
        : "该日已有相同主题的同类型日程";
      res.status(409).json({ error: errorMsg });
      return;
    }
    const updated = await updateStreamPlan(id, { date, timeType, startTime, title });
    if (!updated) {
      res.status(404).json({ error: "直播计划不存在" });
      return;
    }
    res.status(200).json({
      ok: true,
      id: updated.id,
      date: updated.date,
      timeType: updated.timeType,
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
