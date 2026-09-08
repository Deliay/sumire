# 后端计划域 Spec（servers/api — stream-plans）

直播计划（周表）的 CRUD API，数据存 MongoDB。

## 数据模型（db/streamPlans.ts）

Mongo `streamplans` 集合：`date`（YYYY-MM-DD，有索引）、`timeType`（fixed/tbd/allDay，缺省 fixed）、`startTime`（HH:mm，仅 fixed 时有值）、`title`、`createdBy`、`createdAt`、`updatedAt`。判重键 `(date, timeType, startTime, title)`，编辑时排除自身。

## 端点

| 方法+路径 | 鉴权 | 要点 |
|---|---|---|
| GET `/api/stream-plans` | **公开** | query `from`/`to`（YYYY-MM-DD，非法 400），按 date 升序，同日按 全天 → 固定时间（startTime 升序）→ 时间待定 |
| POST `/api/stream-plans` | admin+ | date 真实日期校验（拒 2026-02-30）、timeType 缺省 fixed（非法 400）、startTime HH:mm（fixed 时必填，tbd/allDay 时必须为空）、title trim 后 1–50 字符；四元组组合判重 409 |
| PUT `/api/stream-plans/:id` | admin+ | ObjectId 校验 400；排除自身判重 409；不存在 404 |
| DELETE `/api/stream-plans/:id` | admin+ | ObjectId 400；不存在 404 |

公开读、受限写（cookieAuth）。契约：`contract/stream-plans.openapi.yaml`。

## timeType 校验规则

- 缺省行为：未提供 `timeType` 时按 `fixed` 处理（兼容旧请求）
- 非法值：提供 `timeType` 但不在枚举内（fixed/tbd/allDay）→ 400「日程类型非法」
- 组合约束：
  - fixed 时 `startTime` 必填且合法 → 否则 400「开始时间格式非法」
  - tbd/allDay 时 `startTime` 必须为空 → 否则 400「时间待定/全天日程无需填写开始时间」
- 写入时 tbd/allDay 的 `startTime` 一律置 null（不信任客户端置空）

## 排序规则

应用层统一排序（Mongo 仅按 date 排序，应用层处理类型间排序）：
1. 同日按类型秩：allDay(0) < fixed(1) < tbd(2)
2. 同类型间：fixed 按 startTime 升序，tbd/allDay 无序
