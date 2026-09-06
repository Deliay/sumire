import { beforeAll, describe, expect, it } from "vitest";
import {
  request,
  login,
  CookieJar,
  asSuperadmin,
  waitForReady,
} from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

const rand = () => `t_${Math.random().toString(36).slice(2, 10)}`;

const INVALID_OBJECT_ID = "not-a-valid-object-id";

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
    // 检查是否有 Set-Cookie 头（包含 sumire_vid）
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
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
