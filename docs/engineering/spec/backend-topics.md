# 后端棉花糖域 Spec（servers/api — topics / marshmallows）

Express 5 + TS strict 纯 API 服务，棉花糖域提供主题管理与匿名投递功能。

## 模块结构

| 文件 | 职责 |
|------|------|
| `src/db/topics.ts` | Topic model + deriveStatus 纯函数 + CRUD |
| `src/db/marshmallows.ts` | Marshmallow model + CRUD + 审核状态更新 |
| `src/topics/visitorCookie.ts` | 访客 Cookie 中间件（`sumire_vid`） |
| `src/topics/rateLimit.ts` | 三维度固定窗口限速（Redis/Memory） |
| `src/topics/reviewQueue.ts` | Redis List 审核队列（独立连接避免阻塞） |
| `src/topics/reviewWorker.ts` | BRPOP 消费循环 + AI 客户端（openai/claude） |
| `src/topics/reviewPrompt.ts` | AI 审核系统提示词 |
| `src/routes/topics.ts` | 管理端点 + 公开端点路由 |

## 数据模型

### Topic（`topics` 集合）

| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 标题（trim 后 1–100 字符） |
| description | string | 描述（Markdown） |
| startAt | Date | 开始时间 |
| endAt | Date | 结束时间 |
| charLimit | number | 字数限制（100–10000） |
| aiReviewEnabled | boolean | 是否启用 AI 审核（默认 true） |
| collectingStopped | boolean | 手动停止采集（默认 false） |
| archived | boolean | 是否归档（默认 false） |
| createdAt | Date | 创建时间 |
| updatedAt | Date | 更新时间 |

派生状态 `deriveStatus(topic, now)`：
- `archived` → `ended`
- `now < startAt` → `upcoming`
- `collectingStopped || now > endAt` → `ended`
- 否则 → `collecting`

### Marshmallow（`marshmallows` 集合）

| 字段 | 类型 | 说明 |
|------|------|------|
| topicId | string | 关联主题 ID |
| content | string | 内容 |
| adopted | boolean | 是否采用 |
| aiReview | object \| null | 审核结果（null=未启用） |
| visitorId | string | 访客 ID 哈希（sha256） |
| clientKeyHash | string | 客户端标识哈希（sha256） |
| ip | string | 投递 IP |
| createdAt | Date | 投递时间 |

aiReview 结构：
```typescript
{
  status: "pending" | "approved" | "rejected";
  filteredReason?: string;
  ignoredByAdmin: boolean;
}
```

## 访客 Cookie

- Cookie 名：`sumire_vid`
- 属性：HttpOnly / Path=/ / SameSite=Lax / Max-Age=31536000（1 年）/ 生产 Secure
- 首次访问颁发 `crypto.randomUUID()`，合法值透传，非法值重颁
- GET `/api/topics/:id/public` 也挂载此中间件，确保访问时已颁发

## 限速

三维度固定窗口：clientKey（localStorage）+ visitorId（Cookie）+ IP

| 维度 | 窗口 | 限制 |
|------|------|------|
| 每个 | 1 分钟 | 1 条 |
| 每个 | 1 小时 | 5 条 |

实现：
- `check(key)`：读取当前计数，不递增
- `record(key)`：原子递增所有窗口
- 超限返回 429「操作频率过快」

并发窗口：两个请求可能同时通过 check 后各自 record，突破「1分钟1条」限制。这是固定窗口限速的已知权衡，量级可接受。

## AI 审核

### 配置

环境变量 `SUMIRE_REVIEW_AI_TYPE`（openai/claude）、`SUMIRE_REVIEW_AI_ENDPOINT`、`SUMIRE_REVIEW_AI_API_KEY`。

启动时 fail-fast：任一已配置则三者必须齐全，否则启动失败。

### 队列

- Redis List `marsh:ai-review`
- LPUSH 入队，BRPOP 消费（使用 `redis.duplicate()` 独立连接，不阻塞主连接）

### Worker

- 消费循环：BRPOP → 读 marshmallow → 调 AI → 回写结果
- 重试：最多 2 次，退避 1s/5s
- 兜底：最终失败回写 `rejected` + 「审核服务暂时不可用」
- 幂等：`status !== "pending"` 跳过

### 未配置时

- `aiReviewEnabled` 参数为 `topic.aiReviewEnabled && deps.aiReviewEnabled`
- 未配置时 `aiReview = null`，不入队

## 端点

### 管理端点（admin+）

| 方法+路径 | 要点 |
|---|---|
| GET `/api/topics` | 列表（`?archived=true` 含归档） |
| POST `/api/topics` | 新建（五字段必填） |
| GET `/api/topics/:id` | 详情（含派生 status） |
| PUT `/api/topics/:id` | 编辑 |
| POST `/api/topics/:id/collecting` | 开始/停止收集 |
| POST `/api/topics/:id/archive` | 归档（已归档 410） |
| GET `/api/topics/:id/marshmallows` | 棉花糖列表（分页，pageSize ≤100） |
| PATCH `/api/marshmallows/:id` | 采用/忽略 AI 过滤 |

### 公开端点

| 方法+路径 | 要点 |
|---|---|
| GET `/api/topics/:id/public` | 公开信息（不含审核字段） |
| POST `/api/topics/:id/marshmallows` | 投递（返回 `{ ok: true }`） |

契约：`contract/topics.openapi.yaml`。
