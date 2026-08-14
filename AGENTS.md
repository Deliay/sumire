# sumire

枝堇Sumire（VirtuaReal 二十八期）非官方粉丝网站 & 工具集。应援色 `#b4a6bf`。

- 站点为非官方粉丝作品，素材版权归主播及所属社团所有；
- 所有内容以官方公开信息为准，禁止二次设定。

## 优先使用 SKILL

在你不确定的时候，优先从已有的 SKILL 中检索知识。有 SKILL 则使用 SKILL。

| Skill | Description |
|------|------|
| z-product | 产品文档创建与生命周期管理 (PRD 工作流) |
| z-project | 项目创建与管理 (monorepo 支持、技术栈选择) |
| z-coding | 契约式开发工作流 (提案、契约、实现) |
| z-git | Git 工作流管理 |
| z-document | 文档规范 (Zettelkasten 方法、Mermaid 图表) |
| z-test | API 测试和 E2E 测试工作流 |
| tdd | 测试驱动开发流程 |
| vercel-react-best-practices | React / Next.js 最佳实践 |
| frontend-design | 前端界面设计规范 |

## Monorepo 结构

- `apps/bookstore/`：堇色书屋（粉丝站前端，Next.js + SSG；含后台 `/backdoor` 路由区，公开页与后台分别置于 `(site)` 路由组与 `app/backdoor`）
- `servers/api/`：后台鉴权与用户管理 API（Express 5 + TS strict 纯 API，仅 `/api/*`）
- `contract/`：API 契约（`backdoor-auth.openapi.yaml`、`stream-plans.openapi.yaml`，均为单一事实源）
- `tests/api/`：API 黑盒集成测试（Vitest + fetch + Cookie jar）
- `tests/e2e/`：E2E 集成测试（Playwright，bookstore 公开页 + `/backdoor`）
- `infra/aspire/`：本地编排 AppHost（bookstore + api + Redis + MongoDB 四资源）
- `docs/`：产品文档、技术方案、设计文档
- 包管理：pnpm workspace（`pnpm-workspace.yaml` 管理 `apps/*`、`servers/*`、`tests/*`）

## 文档结构

- 产品文档：`docs/product/requirements/`（生命周期：`draft` → `reviewed` → `shipping` → `released`，以 `YYYY-MM-DD` 为前缀命名）
- 技术方案：`docs/engineering/proposals/`（以 `YYYY-MM-DD` 为前缀命名）
- 设计文档：`docs/design/`（视觉识别与页面设计细节）

## 开发约定

- 分支命名：`<type>/<slug>`（`prd` 文档分支 / `feat` 开发分支），禁止 rebase/squash，只 merge；
- 开发遵循 TDD；写代码前加载对应目录的 AGENTS.md 与 `docs/engineering/frontend-rules.md`（前端）/ `docs/engineering/backend-rules.md`（后端）；
- 本地联调统一用 Aspire 编排（`cd infra/aspire && aspire start`），集成测试端点经 `aspire describe` 注入；
- 未上线的功能不得在 UI 中显示占位入口。
