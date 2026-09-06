import { Router, type Request, type Response } from "express";
import { isValidObjectId } from "mongoose";
import {
  createTopic,
  listTopics,
  findTopicOutput,
  findTopic,
  updateTopic,
  setCollectingStopped,
  archiveTopic,
  deriveStatus,
} from "../db/topics";
import {
  createMarshmallow,
  listMarshmallows,
  findMarshmallow,
  setAdopted,
  setIgnoreAiFilter,
} from "../db/marshmallows";
import { requireRole } from "../rbac/requireRole";
import { visitorCookieMiddleware } from "../topics/visitorCookie";
import { marshRateLimit, type MarshRateLimiter } from "../topics/rateLimit";
import type { ReviewQueue } from "../topics/reviewQueue";

export interface TopicsRouterDeps {
  marshRateLimiter: MarshRateLimiter;
  reviewQueue?: ReviewQueue;
}

export function createTopicsRouter(deps: TopicsRouterDeps): Router {
  const router = Router();

  // ===== 管理端点 =====

  router.get("/", requireRole("admin"), async (req: Request, res: Response) => {
    const archived = req.query.archived === "true";
    const topics = await listTopics({ archived });
    res.json({ ok: true, topics });
  });

  router.post("/", requireRole("admin"), async (req: Request, res: Response) => {
    const { title, description, startAt, endAt, charLimit, aiReviewEnabled } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "标题不能为空" });
      return;
    }
    if (title.trim().length > 100) {
      res.status(400).json({ error: "标题不能超过 100 字符" });
      return;
    }
    if (typeof description !== "string") {
      res.status(400).json({ error: "描述不能为空" });
      return;
    }
    const startAtDate = startAt ? new Date(startAt) : null;
    const endAtDate = endAt ? new Date(endAt) : null;
    if (!startAtDate || isNaN(startAtDate.getTime())) {
      res.status(400).json({ error: "开始日期格式非法" });
      return;
    }
    if (!endAtDate || isNaN(endAtDate.getTime())) {
      res.status(400).json({ error: "结束日期格式非法" });
      return;
    }
    if (startAtDate >= endAtDate) {
      res.status(400).json({ error: "开始日期必须早于结束日期" });
      return;
    }
    const limit = Number(charLimit);
    if (!Number.isFinite(limit) || limit < 100 || limit > 10000) {
      res.status(400).json({ error: "字数限制必须在 100–10000 之间" });
      return;
    }

    const topic = await createTopic({
      title: title.trim(),
      description,
      startAt: startAtDate,
      endAt: endAtDate,
      charLimit: limit,
      aiReviewEnabled: aiReviewEnabled !== false,
    });
    res.status(201).json({ ok: true, id: topic.id });
  });

  router.get("/:id", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "主题 ID 非法" });
      return;
    }
    const topic = await findTopicOutput(id);
    if (!topic) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    res.json({ ok: true, topic });
  });

  router.put("/:id", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "主题 ID 非法" });
      return;
    }
    const { title, description, startAt, endAt, charLimit, aiReviewEnabled } = req.body ?? {};
    if (typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "标题不能为空" });
      return;
    }
    if (title.trim().length > 100) {
      res.status(400).json({ error: "标题不能超过 100 字符" });
      return;
    }
    if (typeof description !== "string") {
      res.status(400).json({ error: "描述不能为空" });
      return;
    }
    const startAtDate = startAt ? new Date(startAt) : null;
    const endAtDate = endAt ? new Date(endAt) : null;
    if (!startAtDate || isNaN(startAtDate.getTime())) {
      res.status(400).json({ error: "开始日期格式非法" });
      return;
    }
    if (!endAtDate || isNaN(endAtDate.getTime())) {
      res.status(400).json({ error: "结束日期格式非法" });
      return;
    }
    if (startAtDate >= endAtDate) {
      res.status(400).json({ error: "开始日期必须早于结束日期" });
      return;
    }
    const limit = Number(charLimit);
    if (!Number.isFinite(limit) || limit < 100 || limit > 10000) {
      res.status(400).json({ error: "字数限制必须在 100–10000 之间" });
      return;
    }

    const updated = await updateTopic(id, {
      title: title.trim(),
      description,
      startAt: startAtDate,
      endAt: endAtDate,
      charLimit: limit,
      aiReviewEnabled,
    });
    if (!updated) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/:id/collecting", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "主题 ID 非法" });
      return;
    }
    const topic = await findTopic(id);
    if (!topic) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    if (topic.archived) {
      res.status(409).json({ error: "主题已归档，无法操作" });
      return;
    }
    const { action } = req.body ?? {};
    if (action === "stop") {
      await setCollectingStopped(id, true);
    } else if (action === "start") {
      await setCollectingStopped(id, false);
    } else {
      res.status(400).json({ error: "action 必须为 start 或 stop" });
      return;
    }
    res.json({ ok: true });
  });

  router.post("/:id/archive", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "主题 ID 非法" });
      return;
    }
    const topic = await findTopic(id);
    if (!topic) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    if (topic.archived) {
      res.status(410).json({ error: "主题已归档" });
      return;
    }
    await archiveTopic(id);
    res.json({ ok: true });
  });

  router.get("/:id/marshmallows", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "主题 ID 非法" });
      return;
    }
    const topic = await findTopicOutput(id);
    if (!topic) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const result = await listMarshmallows(id, { page, pageSize });
    res.json({ ok: true, ...result });
  });

  router.patch("/marshmallows/:id", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "棉花糖 ID 非法" });
      return;
    }
    const marsh = await findMarshmallow(id);
    if (!marsh) {
      res.status(404).json({ error: "棉花糖不存在" });
      return;
    }
    const { adopted, ignoreAiFilter } = req.body ?? {};
    if (adopted === undefined && ignoreAiFilter === undefined) {
      res.status(400).json({ error: "请提供 adopted 或 ignoreAiFilter 字段" });
      return;
    }
    if (adopted !== undefined) {
      await setAdopted(id, Boolean(adopted));
    }
    if (ignoreAiFilter !== undefined) {
      await setIgnoreAiFilter(id, Boolean(ignoreAiFilter));
    }
    res.json({ ok: true });
  });

  // ===== 公开端点 =====

  router.get("/:id/public", async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: "主题 ID 非法" });
      return;
    }
    const topic = await findTopicOutput(id);
    if (!topic) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    // 返回公开信息（不含审核管理字段）
    res.json({
      ok: true,
      topic: {
        id: topic.id,
        title: topic.title,
        description: topic.description,
        startAt: topic.startAt,
        endAt: topic.endAt,
        charLimit: topic.charLimit,
        status: topic.status,
      },
    });
  });

  router.post(
    "/:id/marshmallows",
    visitorCookieMiddleware,
    marshRateLimit(deps.marshRateLimiter),
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      if (!isValidObjectId(id)) {
        res.status(400).json({ error: "主题 ID 非法" });
        return;
      }
      const topic = await findTopic(id);
      if (!topic) {
        res.status(404).json({ error: "主题不存在" });
        return;
      }
      const status = deriveStatus(topic, new Date());
      if (status === "upcoming") {
        res.status(409).json({ error: "主题尚未开始，无法投递" });
        return;
      }
      if (status === "ended") {
        res.status(409).json({ error: "主题已结束，无法投递" });
        return;
      }
      if (topic.archived) {
        res.status(410).json({ error: "主题已归档，无法投递" });
        return;
      }
      const { content, clientKey } = req.body ?? {};
      if (typeof content !== "string" || !content.trim()) {
        res.status(400).json({ error: "内容不能为空" });
        return;
      }
      if (content.trim().length > topic.charLimit) {
        res.status(400).json({ error: `内容不能超过 ${topic.charLimit} 字` });
        return;
      }
      if (typeof clientKey !== "string" || !clientKey.trim()) {
        res.status(400).json({ error: "客户端标识不能为空" });
        return;
      }

      const marsh = await createMarshmallow({
        topicId: id,
        content: content.trim(),
        visitorId: req.visitorId,
        clientKeyHash: clientKey.trim(),
        ip: req.ip ?? req.socket?.remoteAddress ?? "unknown",
        aiReviewEnabled: topic.aiReviewEnabled,
      });

      if (topic.aiReviewEnabled && deps.reviewQueue) {
        await deps.reviewQueue.enqueue({
          marshmallowId: marsh.id,
          topicId: id,
        });
      }

      res.status(201).json({ ok: true });
    },
  );

  return router;
}
