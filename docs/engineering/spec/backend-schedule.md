# 后端计划域 Spec（servers/api — stream-plans）

直播计划（周表）的 CRUD API，数据存 MongoDB。

## 数据模型（db/streamPlans.ts）

Mongo `streamplans` 集合：`date`（YYYY-MM-DD，有索引）、`startTime`（HH:mm）、`title`、`createdBy`、`createdAt`、`updatedAt`。判重键 `(date, startTime, title)`，编辑时排除自身。

## 端点

| 方法+路径 | 鉴权 | 要点 |
|---|---|---|
| GET `/api/stream-plans` | **公开** | query `from`/`to`（YYYY-MM-DD，非法 400），按 date+startTime 升序 |
| POST `/api/stream-plans` | admin+ | date 真实日期校验（拒 2026-02-30）、startTime HH:mm、title trim 后 1–50 字符；三字段组合判重 409 |
| PUT `/api/stream-plans/:id` | admin+ | ObjectId 校验 400；排除自身判重 409；不存在 404 |
| DELETE `/api/stream-plans/:id` | admin+ | ObjectId 400；不存在 404 |

公开读、受限写（cookieAuth）。契约：`contract/stream-plans.openapi.yaml`。
