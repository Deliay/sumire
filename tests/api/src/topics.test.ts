import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import {
  request,
  asSuperadmin,
  waitForReady,
  createRoleAccount,
  strongPassword,
} from "./client.js";

// 投递限速 key 清理用（经 aspire describe redis 取端点注入）；未提供则跳过清理，
// 同一 IP 的 1 分钟/1 小时固定窗口限速可能使相邻投递用例串扰。
const REDIS_URL = process.env.REDIS_URL ?? "";

beforeAll(async () => {
  await waitForReady();
});

const rand = () => `t_${Math.random().toString(36).slice(2, 10)}`;

const INVALID_OBJECT_ID = "not-a-valid-object-id";

/** 清理投递限速 Redis key（marsh:1m:* / marsh:1h:*），保证用例隔离可重复运行。 */
async function clearRateLimit(): Promise<void> {
  if (!REDIS_URL) return;
  // Aspire 注入的 Redis 为 TLS（rediss://）自签证书，清理连接禁用证书校验
  const opts = REDIS_URL.startsWith("rediss://")
    ? { tls: { rejectUnauthorized: false } }
    : {};
  const redis = new Redis(REDIS_URL, { ...opts, lazyConnect: true });
  try {
    const keys = await redis.keys("marsh:*");
    if (keys.length) await redis.del(...keys);
  } catch (e) {
    console.warn("限速 key 清理失败", e);
  } finally {
    redis.disconnect();
  }
}

beforeEach(async () => {
  await clearRateLimit();
});

// ===== 主题管理端点 =====

describe("POST /api/topics（新建主题）", () => {
  it("topics-create-201: 超管可新建主题", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `测试主题_${rand()}`,
        description: "测试描述",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
      },
    });
    expect(res.status).toBe(201);
    expect((res.body as { ok: boolean }).ok).toBe(true);
    expect(typeof (res.body as { id: string }).id).toBe("string");
  });

  it("topics-create-401: 未登录 → 401", async () => {
    const res = await request("/api/topics", {
      method: "POST",
      body: {
        title: `测试主题_${rand()}`,
        description: "测试描述",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
      },
    });
    expect(res.status).toBe(401);
  });

  it("topics-create-400: 缺少必填字段 → 400", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: { title: "" },
    });
    expect(res.status).toBe(400);
  });
});

describe("GET /api/topics（主题列表）", () => {
  it("topics-list-200: 超管可获取主题列表", async () => {
    const sa = await asSuperadmin();
    const res = await request("/api/topics", { jar: sa });
    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
    expect(Array.isArray((res.body as { topics: unknown[] }).topics)).toBe(true);
  });
});

describe("GET /api/topics/:id（主题详情）", () => {
  it("topics-detail-200: 超管可获取主题详情", async () => {
    const sa = await asSuperadmin();
    // 先创建一个主题
    const createRes = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `详情测试_${rand()}`,
        description: "详情描述",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
      },
    });
    const topicId = (createRes.body as { id: string }).id;

    const res = await request(`/api/topics/${topicId}`, { jar: sa });
    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);
  });

  it("topics-detail-404: 不存在的 ID → 404", async () => {
    const sa = await asSuperadmin();
    const res = await request(`/api/topics/${INVALID_OBJECT_ID}`, { jar: sa });
    expect(res.status).toBe(404);
  });
});

// ===== 公开端点 =====

describe("GET /api/topics/:id/public（公开信息）", () => {
  it("topics-public-200: 未登录可获取公开信息", async () => {
    const sa = await asSuperadmin();
    // 先创建一个主题
    const createRes = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `公开测试_${rand()}`,
        description: "公开描述",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
      },
    });
    const topicId = (createRes.body as { id: string }).id;

    const res = await request(`/api/topics/${topicId}/public`);
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; topic: { title: string; status: string } };
    expect(body.ok).toBe(true);
    expect(body.topic.title).toBeDefined();
    expect(body.topic.status).toBeDefined();
  });

  it("topics-public-cookie: GET /public 响应带 Set-Cookie", async () => {
    const sa = await asSuperadmin();
    const createRes = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `Cookie测试_${rand()}`,
        description: "测试",
        startAt: new Date().toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
      },
    });
    const topicId = (createRes.body as { id: string }).id;

    const res = await request(`/api/topics/${topicId}/public`);
    expect(res.status).toBe(200);
    // 检查 Set-Cookie 头是否包含 sumire_vid
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("sumire_vid=");
  });
});

describe("POST /api/topics/:id/marshmallows（投递棉花糖）", () => {
  it("marshmallows-post-201: 成功投递", async () => {
    const sa = await asSuperadmin();
    // 创建一个进行中的主题
    const createRes = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `投递测试_${rand()}`,
        description: "测试",
        startAt: new Date(Date.now() - 86400000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
        aiReviewEnabled: false,
      },
    });
    const topicId = (createRes.body as { id: string }).id;

    const res = await request(`/api/topics/${topicId}/marshmallows`, {
      method: "POST",
      body: {
        content: "测试棉花糖内容",
        clientKey: "test-client-key",
      },
    });
    expect(res.status).toBe(201);
    expect((res.body as { ok: boolean }).ok).toBe(true);
  });

  it("marshmallows-post-400: 内容为空 → 400", async () => {
    const sa = await asSuperadmin();
    const createRes = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `空内容测试_${rand()}`,
        description: "测试",
        startAt: new Date(Date.now() - 86400000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
        aiReviewEnabled: false,
      },
    });
    const topicId = (createRes.body as { id: string }).id;

    const res = await request(`/api/topics/${topicId}/marshmallows`, {
      method: "POST",
      body: { content: "", clientKey: "test" },
    });
    expect(res.status).toBe(400);
  });
});

// ===== 棉花糖管理端点 =====

describe("PATCH /api/marshmallows/:id（更新棉花糖状态）", () => {
  it("marshmallows-patch-200: 采用棉花糖", async () => {
    const sa = await asSuperadmin();
    // 创建主题并投递
    const topicRes = await request("/api/topics", {
      method: "POST",
      jar: sa,
      body: {
        title: `采用测试_${rand()}`,
        description: "测试",
        startAt: new Date(Date.now() - 86400000).toISOString(),
        endAt: new Date(Date.now() + 86400000).toISOString(),
        charLimit: 1000,
        aiReviewEnabled: false,
      },
    });
    const topicId = (topicRes.body as { id: string }).id;

    await request(`/api/topics/${topicId}/marshmallows`, {
      method: "POST",
      body: { content: "测试内容", clientKey: "test" },
    });

    // 获取棉花糖列表
    const listRes = await request(`/api/topics/${topicId}/marshmallows`, { jar: sa });
    const marshmallows = (listRes.body as { marshmallows: Array<{ id: string }> }).marshmallows;
    expect(marshmallows.length).toBeGreaterThan(0);

    const marshId = marshmallows[0].id;
    const patchRes = await request(`/api/marshmallows/${marshId}`, {
      method: "PATCH",
      jar: sa,
      body: { adopted: true },
    });
    expect(patchRes.status).toBe(200);
    expect((patchRes.body as { ok: boolean }).ok).toBe(true);
  });
});

// ===== round 9：恢复已归档主题 =====

async function createCollectingTopic(sa: Awaited<ReturnType<typeof asSuperadmin>>, title: string) {
  const res = await request("/api/topics", {
    method: "POST",
    jar: sa,
    body: {
      title,
      description: "测试",
      startAt: new Date(Date.now() - 86400000).toISOString(),
      endAt: new Date(Date.now() + 86400000).toISOString(),
      charLimit: 1000,
      aiReviewEnabled: false,
    },
  });
  return (res.body as { id: string }).id;
}

describe("POST /api/topics/:id/restore（恢复已归档主题）", () => {
  it("topics-restore-200: 归档后可恢复，archived 置回 false", async () => {
    const sa = await asSuperadmin();
    const id = await createCollectingTopic(sa, `恢复测试_${rand()}`);
    await request(`/api/topics/${id}/archive`, { method: "POST", jar: sa });

    const res = await request(`/api/topics/${id}/restore`, { method: "POST", jar: sa });
    expect(res.status).toBe(200);
    expect((res.body as { ok: boolean }).ok).toBe(true);

    const detail = await request(`/api/topics/${id}`, { jar: sa });
    expect((detail.body as { topic: { archived: boolean } }).topic.archived).toBe(false);
  });

  it("topics-restore-404: 非法 ID → 404", async () => {
    const sa = await asSuperadmin();
    const res = await request(`/api/topics/${INVALID_OBJECT_ID}/restore`, {
      method: "POST",
      jar: sa,
    });
    expect(res.status).toBe(404);
  });

  it("topics-restore-404: 不存在的 ID → 404", async () => {
    const sa = await asSuperadmin();
    const res = await request(`/api/topics/${new Array(24).fill("a").join("")}/restore`, {
      method: "POST",
      jar: sa,
    });
    expect(res.status).toBe(404);
  });

  it("topics-restore-409: 未归档主题 → 409", async () => {
    const sa = await asSuperadmin();
    const id = await createCollectingTopic(sa, `未归档恢复测试_${rand()}`);
    const res = await request(`/api/topics/${id}/restore`, { method: "POST", jar: sa });
    expect(res.status).toBe(409);
    expect((res.body as { error: string }).error).toContain("无需恢复");
  });

  it("topics-restore-401: 未登录 → 401", async () => {
    const sa = await asSuperadmin();
    const id = await createCollectingTopic(sa, `未登录恢复测试_${rand()}`);
    const res = await request(`/api/topics/${id}/restore`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("topics-restore-403: member 角色 → 403", async () => {
    const member = await createRoleAccount("member", `m_${rand()}`, strongPassword);
    const sa = await asSuperadmin();
    const id = await createCollectingTopic(sa, `member恢复测试_${rand()}`);
    const res = await request(`/api/topics/${id}/restore`, { method: "POST", jar: member });
    expect(res.status).toBe(403);
  });
});

// ===== round 9：公开进行中主题列表 =====

describe("GET /api/topics/public（进行中主题列表）", () => {
  it("topics-ongoing-200: 未登录可获取进行中主题列表", async () => {
    const sa = await asSuperadmin();
    await createCollectingTopic(sa, `进行中列表_${rand()}`);

    const res = await request("/api/topics/public");
    expect(res.status).toBe(200);
    const body = res.body as { ok: boolean; topics: Array<{ title: string; status: string }> };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.topics)).toBe(true);
    // 新建的 collecting 主题应出现在列表中
    expect(body.topics.some((t) => t.title.startsWith("进行中列表_"))).toBe(true);
  });

  it("topics-ongoing-filter: 仅包含 collecting，且不含归档/审核管理字段", async () => {
    const sa = await asSuperadmin();
    // 未开始（upcoming）
    const upcomingId = await (
      await request("/api/topics", {
        method: "POST",
        jar: sa,
        body: {
          title: `upcoming_${rand()}`,
          description: "测试",
          startAt: new Date(Date.now() + 86400000).toISOString(),
          endAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          charLimit: 1000,
          aiReviewEnabled: false,
        },
      })
    ).body?.id;
    // 已归档（archived）
    const archId = await createCollectingTopic(sa, `归档排除_${rand()}`);
    await request(`/api/topics/${archId}/archive`, { method: "POST", jar: sa });

    const res = await request("/api/topics/public");
    const topics = (res.body as { topics: Array<{ title: string; status: string }> }).topics;
    // upcoming 主题不应出现
    expect(topics.some((t) => t.title.startsWith("upcoming_"))).toBe(false);
    // 归档主题不应出现
    expect(topics.some((t) => t.title.startsWith("归档排除_"))).toBe(false);
    // 每条均为 collecting 且不含审核/管理字段
    for (const t of topics) {
      expect(t.status).toBe("collecting");
      expect("aiReviewEnabled" in t).toBe(false);
      expect("archived" in t).toBe(false);
      expect("collectingStopped" in t).toBe(false);
    }
    void upcomingId;
  });

  it("topics-ongoing-cookie: GET /public 不挂访客 Cookie", async () => {
    const res = await request("/api/topics/public");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
