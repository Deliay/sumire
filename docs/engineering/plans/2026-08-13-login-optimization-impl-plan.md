---
description: 登录优化实现方案——基于 PRD v1.0 与技术提案 v1.0 的实施计划（分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 登录优化 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-13-login-optimization-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-13-login-optimization-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/login-optimization`（需求总 PR：<https://github.com/Deliay/sumire/pull/6>）
**创建日期**: 2026-08-13
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。本需求无契约变更、无后端改动，仅涉及 `apps/bookstore` 前端与 e2e 测试，单 subagent 即可串行完成，无需并行拆分。全程遵循 TDD（先写失败测试再实现），实现代码前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`。

## 1. 现状与差距

| 项 | 现状 | 目标（依据提案） |
|----|------|----------------|
| `apps/bookstore/components/Footer.tsx:50-55` | 右下角渲染「管理 →」链接指向 `/backdoor` | 删除该链接，页脚其余内容与布局不变 |
| `apps/bookstore/tests/unit/footer-link.test.tsx:19-22` | 断言「渲染管理链接」 | 改为断言「不渲染指向 /backdoor 的链接」 |
| `apps/bookstore/features/backdoor/api.ts:16-18` | 导出 `API_BASE_URL`，未配置时为空串 | 集中导出「已配置」布尔判断（如 `API_CONFIGURED`），作为唯一判断源 |
| `apps/bookstore/app/backdoor/layout.tsx` | 仅挂载 `SessionProvider` | 增加构建时守卫：未配置即 `notFound()` |
| 后台 404 页 | 全站无 `not-found.tsx`（现仅有 Next 默认 404） | 新增 `app/backdoor/not-found.tsx`，样式与站点一致（仅用 `@theme` token 色），含「页面不存在」提示与返回首页引导 |
| `tests/e2e/src/bookstore/footer-link.spec.ts` | 断言页脚存在「管理 →」链接（旧需求 AC-12~14） | 改写为断言公开站任意页面不出现指向 `/backdoor` 的链接 |
| 未配置形态 e2e | 不存在 | 新增：未配置 `NEXT_PUBLIC_API_BASE_URL` 的构建下访问 `/backdoor` 呈现 404 |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/login-optimization`，需求总 PR #6 随提交更新；
- 实现工作按提案约定在开发分支 `feat/login-optimization`（自 `prd/login-optimization` 切出）上进行，完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支

- 自 `prd/login-optimization` 切出 `feat/login-optimization` 并推送远端。

**验证**：`git status` 干净，位于 `feat/login-optimization`。

### 步骤 1：移除 Footer「管理 →」链接（TDD）

1. 先改测试：`apps/bookstore/tests/unit/footer-link.test.tsx` 断言改为「Footer 不渲染任何指向 `/backdoor` 的链接」（`queryByRole("link", { name: /管理/ })` 为 null，且不存在 `href="/backdoor"` 的元素），确认测试变红；
2. 删除 `apps/bookstore/components/Footer.tsx:50-55` 的 `<a href="/backdoor">管理 →</a>`；页脚其余内容、样式与布局保持不变（删除后若 `ml-auto` 等类仅服务于该链接则一并清理）；
3. 确认测试转绿。

**验证**：`pnpm -C apps/bookstore test` 通过。

### 步骤 2：API 配置判断单一事实源（TDD）

1. 先写测试：为 `features/backdoor/api.ts` 增加单测，覆盖「`NEXT_PUBLIC_API_BASE_URL` 为空 ⇒ `API_CONFIGURED === false`」「非空 ⇒ `true`」两分支（通过模块隔离 + 环境变量 stub 实现），确认变红；
2. 在 `api.ts` 中基于既有 `BASE_URL` 导出 `API_CONFIGURED`（基址非空即已配置），layout 与请求层共用此判断，避免口径漂移；
3. 确认转绿。

**验证**：`pnpm -C apps/bookstore test` 通过。

### 步骤 3：`/backdoor` 未配置即 404 守卫（TDD）

1. 新增 `app/backdoor/not-found.tsx`：站点风格 404 页（「页面不存在」提示 + 返回首页引导），视觉严格按 `docs/design/03-backdoor-design.md`，仅用 `@theme` token 色；
2. 先写测试：单测 mock `next/navigation` 的 `notFound` 与 `api.ts` 的 `API_CONFIGURED`，断言「未配置时 layout 调用 `notFound()`」「已配置时正常渲染 children」，确认变红；
3. 在 `app/backdoor/layout.tsx`（Server Component）顶部读取 `API_CONFIGURED`，为 `false` 时调用 `notFound()`；已配置路径行为完全不变；
4. 确认转绿。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿。

### 步骤 4：e2e 覆盖（SKILL: z-test）

复用 `tests/e2e/` 现有工程（服务由 Aspire 编排，`BOOKSTORE_BASE_URL` 注入）：

1. 改写 `tests/e2e/src/bookstore/footer-link.spec.ts`：断言公开站首页及任一内容页均不存在指向 `/backdoor` 的链接；
2. 新增未配置形态用例（如 `tests/e2e/src/backdoor/unconfigured.spec.ts`）：访问 `/backdoor` 及深层地址呈现 404 页，且页面不产生发往主站自身的 `/api/*` 请求。该用例针对「未配置构建」运行——以不设置 `NEXT_PUBLIC_API_BASE_URL` 构建 bookstore 并静态伺服 `out/`，通过独立环境变量（如 `BOOKSTORE_STATIC_BASE_URL`）注入，未设置时 `test.skip`；在 CI/本地以单独命令触发；
3. 已配置形态回归：Aspire 编排下跑通现有 `tests/e2e/src/backdoor/` 全部用例（登录、改密、仪表盘、用户管理），确认无回退。

**验证**：两种构建形态下 e2e 分别全绿。

### 步骤 5：收尾与验收

1. 更新 `apps/bookstore/AGENTS.md`（后台约定补充「未配置 API 基址即 404」守卫说明）；
2. 核对提案 §10 验收标准全量通过，对照 PRD 功能点 1/2 验收标准逐条确认；
3. 推送 `feat/login-optimization` 并提 PR 至 `prd/login-optimization`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：本地 Aspire 编排可用（已配置形态的回归依赖其注入 API 端点）；未配置形态 e2e 依赖 bookstore 静态导出产物可被独立伺服；
- **风险**：守卫为构建期生效——同一构建产物无法通过运行时注入基址切换形态，两种形态须分别构建验证（已在步骤 4 覆盖）；`notFound()` 在 `output: "export"` 下对 `app/backdoor/not-found.tsx` 的静态产物行为需在步骤 3 实测确认，若就近 `not-found` 未按预期产出，回退为根级 `app/not-found.tsx` 并在提案中记录偏差。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-13-login-optimization-prd.md]]
- 技术提案：[[../proposals/2026-08-13-login-optimization-proposal.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 前端规范：[[../frontend-rules.md]]
- 既有实现方案：[[2026-08-12-backdoor-auth-impl-plan]]
