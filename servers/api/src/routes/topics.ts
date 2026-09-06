import { Router, type Request, type Response } from "express";
import crypto from "node:crypto";
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
import type { MarshRateLimiter } from "../topics/rateLimit";
import type { ReviewQueue } from "../topics/reviewQueue";

export interface TopicsRouterDeps {
  marshRateLimiter: MarshRateLimiter;
  reviewQueue?: ReviewQueue;
  /** #4: AI 审核功能是否已配置并可用 */
  aiReviewEnabled?: boolean;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
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
    if (typeof description !== "string" || !description.trim()) {
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
    if (aiReviewEnabled !== undefined && typeof aiReviewEnabled !== "boolean") {
      res.status(400).json({ error: "aiReviewEnabled 必须为布尔值" });
      return;
    }

    const topic = await createTopic({
      title: title.trim(),
      description: description.trim(),
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
      res.status(404).json({ error: "主题不存在" });
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
      res.status(404).json({ error: "主题不存在" });
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
    if (typeof description !== "string" || !description.trim()) {
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
    if (aiReviewEnabled !== undefined && typeof aiReviewEnabled !== "boolean") {
      res.status(400).json({ error: "aiReviewEnabled 必须为布尔值" });
      return;
    }

    const updated = await updateTopic(id, {
      title: title.trim(),
      description: description.trim(),
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
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    const topic = await findTopic(id);
    if (!topic) {
      res.status(404).json({ error: "主题不存在" });
      return;
    }
    // 先判 archived（I10: archived 返回 410 而非 409）
    if (topic.archived) {
      res.status(410).json({ error: "主题已归档，无法操作" });
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
      res.status(404).json({ error: "主题不存在" });
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
      res.status(404).json({ error: "主题不存在" });
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

  // ===== 公开端点 =====

  // B4: GET /:id/public 也挂 visitorCookieMiddleware，确保访问收集页时已颁发 vid
  router.get("/:id/public", visitorCookieMiddleware, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(404).json({ error: "主题不存在" });
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
        aiReviewEnabled: topic.aiReviewEnabled,
        status: topic.status,
      },
    });
  });

  // 投递端点：先校验状态与内容，再限速（I11: 限速移到校验之后）
  router.post(
    "/:id/marshmallows",
    visitorCookieMiddleware,
    async (req: Request, res: Response) => {
      const id = String(req.params.id);
      if (!isValidObjectId(id)) {
        res.status(404).json({ error: "主题不存在" });
        return;
      }
      const topic = await findTopic(id);
      if (!topic) {
        res.status(404).json({ error: "主题不存在" });
        return;
      }
      // 先判 archived（I10）
      if (topic.archived) {
        res.status(410).json({ error: "主题已归档，无法投递" });
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

      // I11: 限速在状态与内容校验通过后执行
      const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
      const keys: string[] = [];
      if (clientKey.trim()) {
        keys.push(`ck:${sha256(clientKey.trim())}`);
      }
      if (req.visitorId) {
        keys.push(`vid:${sha256(req.visitorId)}`);
      }
      keys.push(`ip:${ip}`);

      for (const k of keys) {
        const ok = await deps.marshRateLimiter.check(k);
        if (!ok) {
          res.status(429).json({ error: "操作频率过快" });
          return;
        }
      }
      for (const k of keys) {
        await deps.marshRateLimiter.record(k);
      }

      // B5: 存储 sha256 哈希而非原文
      // #2: 仅在主题和服务端都启用 AI 审核时才设置 pending 状态
      const aiReviewActive = topic.aiReviewEnabled && deps.aiReviewEnabled === true;
      const marsh = await createMarshmallow({
        topicId: id,
        content: content.trim(),
        visitorId: req.visitorId ? sha256(req.visitorId) : undefined,
        clientKeyHash: sha256(clientKey.trim()),
        ip,
        aiReviewEnabled: aiReviewActive,
      });

      // #4: 仅在 AI 审核已配置时入队
      if (aiReviewActive && deps.reviewQueue) {
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

/**
 * 创建棉花糖管理路由（PATCH /api/marshmallows/:id）
 * B2: 独立路由，避免与 topics 路由冲突
 */
export function createMarshmallowsRouter(): Router {
  const router = Router();

  router.patch("/:id", requireRole("admin"), async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!isValidObjectId(id)) {
      res.status(404).json({ error: "棉花糖不存在" });
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

  return router;
}
