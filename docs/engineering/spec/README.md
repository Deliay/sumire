# 技术 Spec 索引

技术 spec 描述系统**当前**的架构与实现约定，是技术现态的单一事实源。与 `proposals/` 不同：proposal 是时点决策文档，spec 持续维护。

## 模块索引

| Spec | 模块 |
|---|---|
| [frontend-bookstore.md](frontend-bookstore.md) | 前端（apps/bookstore）：SSG 架构、路由与守卫、内容管道、日历/弹幕前端 |
| [backend-auth.md](backend-auth.md) | 后端鉴权域：会话、RBAC、用户、登录限流 |
| [backend-schedule.md](backend-schedule.md) | 后端计划域：stream-plans CRUD |
| [backend-live.md](backend-live.md) | 后端直播域：live-history 代理、live-events 归一化/SSE/已读模型 |
| [testing.md](testing.md) | 测试：tests/api 黑盒契约测试、tests/e2e |
| [infra.md](infra.md) | 基础设施：Aspire 编排、环境注入 |

相关但独立的事实源：`contract/*.openapi.yaml`（API 契约，端点字段以契约为准，spec 只描述机制）。

## 维护规范

- 架构、数据模型、端点行为、基础设施变更时，**同一个 PR 内必须同步更新对应 spec**；spec 不描述未实现的设计。
- spec 按模块组织，一个模块一个文件；模块拆分时相应拆分文件并更新本索引。
- spec 只描述「现在是什么」，不记录备选方案与决策过程（留在已归档的 proposal 中）。
