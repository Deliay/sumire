---
description: 导航「小密室」外链实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/secret-room-nav-link，唯一开发分支 feat/secret-room-nav-link。纯前端单组件变更：NavBar.tsx 链接项模型扩展外链形态（EXTERNAL_LINKS 常量追加列表末尾、渲染分支原生 <a target="_blank" rel="noopener noreferrer">、与 isActive/handleNavClick/deck 事件隔离、key 统一取值），nav-bar.test.tsx 单测先行（外链属性/无选中态/无事件派发/移动端菜单/降级仍显示/既有回归），无契约/后端/e2e 变更；上线 PR 内同步 site-pages 与 frontend-bookstore 两份 spec。
type: Permanent
---

# 导航「小密室」外链实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-13-secret-room-nav-link-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-13-secret-room-nav-link-proposal.md]]（v1.0）
**需求总分支**: `prd/secret-room-nav-link`（需求总 PR：<https://github.com/Deliay/sumire/pull/126>）
**开发分支**: `feat/secret-room-nav-link`（自需求总分支切出，**唯一开发分支**，实现/测试/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-13）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD：先补 `nav-bar.test.tsx` 失败用例，再实现 `NavBar.tsx` 外链形态。纯前端单组件变更：无契约、无后端、无 e2e、无编排变更。

**前提事实**（已在需求总分支 `prd/secret-room-nav-link` 核对代码现态，commit 95e749a）：

- `apps/bookstore/components/NavBar.tsx` 现态：链接项模型为内部结构 `{ navKey, label, anchor, route, sectionId }`（`BaseLink` `:17-26`）；`links` 由 `buildBaseLinks()` + `ongoingLink`（棉花糖，`API_CONFIGURED` 门控 `:80-82`）+ `tools.map`（`:83-92`）组成；桌面端 `<ul>`（`:139-156`）与移动端折叠菜单 `<ul>`（`:170-185`）两处渲染均为 `links.map` + `<Link>`，`key={link.route}`，统一走 `hrefOf`（`:106-107`）/`isActive`（`:94-103`）/`handleNavClick`（`:110-119`）；选中态样式 `text-primary`，未选中 `text-ink-dim hover:text-ink`（桌面）/`block text-base tracking-widest`（移动端）。外链项无 `route`/`anchor`/`sectionId` 字段——渲染分支隔离是唯一改动面，`isActive`/`hrefOf`/`handleNavClick` 三函数内部零改动。
- `apps/bookstore/tests/unit/nav-bar.test.tsx` 现态：单一 describe「NavBar 锚点化」11 用例，已 mock `@/features/backdoor/api`（`configured` 开关）与 `next/navigation`（`mockPathname`），有移动端菜单用例范式（`:142-150`，`getAllByRole` 断言双份渲染）；新增用例按既有 mock 与断言风格扩展，无需新设施。
- 文档同步面：`docs/product/spec/site-pages.md` 与 `docs/engineering/spec/frontend-bookstore.md` 均存在，实现 PR 内同步；根 `AGENTS.md` 与 `apps/bookstore/AGENTS.md` 无结构/约定变更（外链项属组件内细节，不入 AGENTS.md——与既有「导航项细节不落 AGENTS.md」口径一致）。
- e2e 不新增 spec 文件（提案 §1.3：外链跳转不宜在 e2e 真实打开第三方站点）。

整体顺序（**串行**，唯一开发分支 `feat/secret-room-nav-link`）：
**切开发分支 → 单测先行（红）→ NavBar 实现（绿）→ spec 同步 + 收尾验收 → PR 回合需求总分支**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 链接项模型 | 仅站内形态（anchor/route/sectionId） | 扩展外链形态：模块常量 `EXTERNAL_LINKS = [{ navKey: "ext-secret-room", label: "小密室", href: "https://sumire.icu" }]`，追加 `links` 末尾 |
| 渲染 | 两处 `links.map` 统一走 `<Link>` + `hrefOf`/`isActive`/`handleNavClick` | 外链项独立分支：原生 `<a href target="_blank" rel="noopener noreferrer">`，不绑三个站内函数、不传 `aria-current` |
| 列表 key | `key={link.route}`（外链项无 route 字段） | 统一 `key={link.route ?? link.href}`（或等价取值），避免 `undefined` key |
| 选中态/事件 | 全部项参与 isActive 与 NAVIGATE_EVENT 派发 | 外链项永不选中、不派发事件、不改 hash（渲染分支处隔离，站内函数零改动） |
| 降级 | 日历/棉花糖受 `API_CONFIGURED` 门控 | 「小密室」恒显示，不经任何门控 |
| 文档 | spec 无外链项记录 | 同 PR 同步 `site-pages.md` 导航小节与 `frontend-bookstore.md` NavBar 链接项模型 |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/secret-room-nav-link`；
- 开发工作（实现 + 单测 + spec 同步）在**唯一开发分支** `feat/secret-room-nav-link` 上进行（自 `prd/secret-room-nav-link` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/secret-room-nav-link` 切出 `feat/secret-room-nav-link` 并推送。开发前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`。

**验证**：`git branch --show-current` 为 `feat/secret-room-nav-link`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：单测先行（apps/bookstore/tests/unit/nav-bar.test.tsx，红）

在既有 mock 设施（`configured` / `mockPathname` / `matchMediaStub`）上新增 describe「外链 小密室」，用例逐条对应提案 §8.1：

1. 渲染「小密室」链接：`getByRole("link", { name: "小密室" })`，断言 `href="https://sumire.icu"`、`target="_blank"`、`rel` 同时含 `noopener` 与 `noreferrer`；
2. 首页任意 hash 下无 `aria-current`（含 `#archive-1` 命中站内项时）；非首页路由（`mockPathname = "/about"`）同样无 `aria-current`；
3. 首页内点击「小密室」：`sumire:navigate` 监听 spy 零调用、`window.location.hash` 不变（对照既有 `:76-87` 用例的 spy 范式）；
4. 移动端：点击「打开菜单」后 `getAllByRole("link", { name: "小密室" })` 得两个（桌面 + 折叠菜单），逐一断言 href/target/rel 一致；
5. `configured = false` 时「小密室」仍渲染（「日历」「棉花糖」缺席不影响）；
6. 回归：既有 11 用例不动仍绿。

先运行确认新增用例失败（组件尚无「小密室」项）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/nav-bar.test.tsx`——新增用例全红、既有用例全绿。

### 步骤 2：NavBar 实现（apps/bookstore/components/NavBar.tsx，绿）

1. 链接项模型扩展：在组件文件内定义外链常量（模块级）：

   ```ts
   const EXTERNAL_LINKS = [{ navKey: "ext-secret-room", label: "小密室", href: "https://sumire.icu" }];
   ```

   类型上让 `links` 数组元素支持外链形态（联合类型或可选 `href`/`external` 标记，取与文件现有风格最简的一种）；`links` 末尾追加：`[...baseLinks, ...ongoingLink, ...tools.map(...), ...EXTERNAL_LINKS]`——固定最后一项，不受工具注册表动态项数量影响；
2. 渲染分支：桌面端与移动端两处 `links.map` 内，外链项走独立分支——`<a href={link.href} target="_blank" rel="noopener noreferrer" className={相同样式}>{link.label}</a>`；不使用 `next/link`、不传 `aria-current`、不绑 `handleNavClick`；样式复用既有未选中态类名（桌面 `text-sm tracking-widest transition-colors text-ink-dim hover:text-ink`，移动端 `block text-base tracking-widest text-ink-dim`）；分支内联三行以内，不抽子组件（提案决策表 §6.1）；
3. key 统一：`key={link.route ?? link.href}`（外链项无 `route`，避免 `key={undefined}` 与冲突）；
4. `isActive`/`hrefOf`/`handleNavClick` 三函数内部零改动——从渲染分支处隔离，外链项类型上就不具备这些函数的入参字段；
5. 移动端点击外链后菜单开合保持既有原生语义，不额外处理（PRD §3.4）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿（含步骤 1 全部新用例转绿）。

### 步骤 3：Spec 同步与收尾验收

1. `docs/product/spec/site-pages.md`：导航小节补充「小密室」外链现态（列表末尾外链、新窗口打开、`rel="noopener noreferrer"`、不参与站内选中态、恒显示不受 API 配置降级影响）；
2. `docs/engineering/spec/frontend-bookstore.md`：NavBar 链接项模型补充外链形态（`EXTERNAL_LINKS` 常量、渲染分支与站内逻辑隔离口径）；
3. 核对 PRD §1.3 / §3.2 验收标准与提案 §10 全量通过（桌面/移动端渲染与属性、永不选中、无事件无 hash 变更、降级仍显示、既有导航零回归、`pnpm lint && pnpm test && pnpm build` 全绿、spec 同步完成）；
4. 推送 `feat/secret-room-nav-link`，提 PR 回合 `prd/secret-room-nav-link`（需求总 PR #126 随之更新）。

## 4. 依赖与风险

- **依赖**：目标站 `https://sumire.icu` 已可公开访问（纯外链，无运行时校验）；无新外部依赖、无新配置项、无契约/后端/编排变更；
- **风险**：外链项无 `route` 字段导致 `key={undefined}`——步骤 2 第 3 条统一 key 取值，移动端双份渲染由步骤 1 用例 4 锁定；
- **风险**：两处渲染分支（桌面/移动端）漏改其一——步骤 1 用例 4 直接断言双份存在且属性一致；
- **风险**：外链误入站内逻辑（isActive/handleNavClick）——渲染分支隔离 + 用例 2/3 锁定无 `aria-current`、无事件派发；三站内函数零改动保证既有导航零回归面最小。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-13-secret-room-nav-link-prd.md]]
- 技术提案：[[../proposals/2026-09-13-secret-room-nav-link-proposal.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 开发规范：[[../frontend-rules.md]]
