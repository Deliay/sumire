---
description: 导航「小密室」外链技术提案——NavBar 新增纯静态外链项（https://sumire.icu，target=_blank + rel=noopener noreferrer），外链不参与站内锚点选中态与 deck 翻页事件，恒显示不受 API 配置降级影响；仅改 NavBar.tsx 与其单测
type: Fleeting
---

# 导航「小密室」外链 - 技术提案

**功能名称**: 导航「小密室」外链（Secret Room Nav Link）
**关联 PRD**: `docs/product/requirements/draft/2026-09-13-secret-room-nav-link-prd.md`
**技术提案版本**: v1.0
**创建日期**: 2026-09-13
**作者**: sumire workflow
**prd-branch**: `prd/secret-room-nav-link`（需求总分支）
**feat-branch**: `feat/secret-room-nav-link`（开发分支，实现时自需求总分支合入 main 后切出）

## 1. 概述

### 1.1 背景

公开站顶部导航（`apps/bookstore/components/NavBar.tsx`）现由三类站内项组成：基础锚点项（主页/档案/素材/日历，href 为 `/#xxx` 锚点形态，首页内经 `NAVIGATE_EVENT` 驱动 deck 翻页）、「棉花糖」独立路由项（`/topics`，仅 `API_CONFIGURED` 时显示）、工具集注册表项（`/tools/:slug`）。全部为站内导航，尚无外链形态。

本期需求：导航新增「小密室」外链，点击新窗口打开 `https://sumire.icu`。

### 1.2 目标

- `NavBar` 支持外链项形态（`<a target="_blank" rel="noopener noreferrer">`），新增「小密室」项固定位于导航列表末尾；
- 外链项与站内导航逻辑完全解耦：不参与 `isActive` 选中态、不触发 `handleNavClick` 的 deck 翻页分支；
- 单测先行覆盖外链渲染属性、无选中态、无事件派发、API 未配置时仍显示。

### 1.3 范围

- **做**：`NavBar.tsx` 外链项支持 + 「小密室」项；`apps/bookstore/tests/unit/nav-bar.test.tsx` 新增用例；上线 PR 内同步 spec。
- **不做**：API/契约/数据库变更；外链项配置化（目标地址硬编码）；导航视觉改版；e2e 不新增 spec 文件（外链跳转不宜在 e2e 真实打开第三方站点）。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph TD
    LAYOUT[(site)/layout.tsx] --> NAV[NavBar.tsx]
    NAV --> BASE[基础锚点项<br/>主页/档案/素材/日历]
    NAV --> TOPICS[棉花糖 /topics<br/>API_CONFIGURED 门控]
    NAV --> TOOLS[工具集注册表项<br/>/tools/:slug]
    NAV --> EXT[外链项 小密室<br/>https://sumire.icu<br/>target=_blank]
    BASE --> DECK[NAVIGATE_EVENT → deck 翻页]
    EXT -.->|不参与| DECK
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js + React（既有） | 仅 `NavBar.tsx` 客户端组件内扩展 |
| 测试 | Vitest + Testing Library（既有） | `nav-bar.test.tsx` 新增 describe/用例 |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `apps/bookstore/components/NavBar.tsx` | 渲染外链项 | 链接项模型扩展 external 形态；外链渲染分支 |
| `apps/bookstore/tests/unit/nav-bar.test.tsx` | 单测覆盖 | 外链属性/无选中态/无事件/降级仍显示 |

## 3. API 设计

无 API 变更，无契约变更。

## 4. 数据模型

无数据模型变更。导航链接模型在组件内扩展（实现要点 1），无持久化。

## 5. 技术实现方案

### 5.1 核心流程

外链项是渲染期常量，无运行时流程：构建链接列表时在末尾追加外链项，渲染命中外链分支输出 `<a>`，点击行为全部交给浏览器原生新窗口语义。

### 5.2 关键实现点

#### 实现点 1: 链接项模型扩展与外链项定义（NavBar.tsx）

- 在组件内为链接项增加可选 `external` 标记形态，例如 `externalLinks` 常量数组：

  ```ts
  const EXTERNAL_LINKS = [{ navKey: "ext-secret-room", label: "小密室", href: "https://sumire.icu" }];
  ```

  追加在 `links` 末尾（`[...baseLinks, ...ongoingLink, ...tools.map(...), ...EXTERNAL_LINKS]`），固定最后一项，不受工具注册表动态项数量影响；
- 目标地址与文案硬编码为模块常量——PRD 明确单一固定地址，不引入配置项；
- **风险点**: 现有 `links.map` 的 `key={link.route}` 对外链项不存在 `route` 字段——外链项以 `navKey`/`href` 作 key，需统一 key 取值（如 `key={link.route ?? link.href}`），避免 key 冲突或 `undefined`。

#### 实现点 2: 渲染分支与事件隔离（NavBar.tsx）

- 渲染时外链项走独立分支：`<a href={link.href} target="_blank" rel="noopener noreferrer" className={相同样式}>label</a>`——不使用 `next/link`（外链无需预取与客户端路由），不传 `aria-current`，不绑 `handleNavClick`；
- 样式复用既有未选中态类名（`text-sm tracking-widest text-ink-dim hover:text-ink`，移动端对应类名），视觉与站内项一致；
- `isActive` / `hrefOf` / `handleNavClick` 三个既有函数对外链项均不调用——从渲染分支处隔离，不改这三个函数内部逻辑（零回归面最小化）；
- 桌面端 `<ul>` 与移动端折叠菜单两处渲染都需同样处理（移动端点击外链后菜单是否收起保持既有 Link 行为之外的原生语义即可，不额外处理）；
- **风险点**: 两处渲染分支重复——外链项仅一项，可接受三行内联分支；若未来外链增多再抽 `NavLinkItem` 子组件（本期不过度抽象）。

#### 实现点 3: Spec 同步（实现 PR 内）

- `docs/product/spec/site-pages.md`：导航小节补充「小密室」外链现态（末尾外链、新窗口、不参与选中态、恒显示）；
- `docs/engineering/spec/frontend-bookstore.md`：NavBar 链接项模型补充外链形态；
- 根 `AGENTS.md` 无需变更（不涉及结构与约定）。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 渲染元素 | 原生 `<a target="_blank">` | `next/link` + target | A | 外链无客户端路由与预取需求，`next/link` 只增复杂度 |
| 地址来源 | 模块内硬编码常量 | env / 配置注入 | A | PRD 指定固定地址；配置化是无需求的投机通用性 |
| 选中态处理 | 外链永不选中 | 外链也参与 isActive | A | 外链无站内路由，选中态无语义；且 PRD 明确不参与 |
| 列表位置 | 固定末尾 | 插入基础项之后 | A | 外链与站内导航视觉分组清晰；不受工具项动态增删影响位置 |
| 抽象层级 | 渲染分支内联 | 立即抽外链子组件/外链配置数组类型 | A | 仅一个外链项，三行分支优于过早抽象；第二个外链出现时再抽 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | 目标站 `https://sumire.icu` 可公开访问 | 纯外链，无运行时校验 |
| 约束 | TDD | 先补 `nav-bar.test.tsx` 失败用例再实现 |
| 约束 | 前端规范 | `docs/engineering/frontend-rules.md`；`pnpm lint && pnpm test` 全绿 |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/secret-room-nav-link` 需求总分支 |

## 7. 项目结构

```
apps/bookstore/
├── components/
│   └── NavBar.tsx                # 链接项模型 + 外链渲染分支 + 「小密室」常量
└── tests/unit/
    └── nav-bar.test.tsx          # 新增外链用例组
docs/product/spec/site-pages.md           # 实现 PR 内同步
docs/engineering/spec/frontend-bookstore.md  # 实现 PR 内同步
```

## 8. 测试策略

### 8.1 测试覆盖要求

`apps/bookstore/tests/unit/nav-bar.test.tsx` 新增用例（先行失败再实现）：

- 渲染「小密室」链接：`href="https://sumire.icu"`、`target="_blank"`、`rel` 同时含 `noopener` 与 `noreferrer`；
- 首页路由任意 hash 下「小密室」均无 `aria-current`；非首页路由同样无 `aria-current`；
- 首页内点击「小密室」不派发 `sumire:navigate` 事件、`location.hash` 不变；
- 移动端打开折叠菜单后存在第二个「小密室」链接，属性一致；
- `API_CONFIGURED=false` 时「小密室」仍渲染（「日历」「棉花糖」缺席不影响）；
- 回归：既有全部用例不动仍绿（基础项 href 锚点形态、选中态、事件派发不变）。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library（jsdom） | 外链属性、无选中态、无事件、降级显示、回归 |
| e2e | 不新增 | 外链跳转涉及第三方站点，不宜在 e2e 真实打开；单测已覆盖可断言行为 |

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地联调 | 既有 Aspire 编排 | 无新增资源配置 |
| 生产 | 既有 bookstore SSG 发布 | 无新增 env，构建产物随流水线更新 |

### 9.2 配置管理

无配置变更。

## 10. 验收标准

- [ ] 技术方案评审通过
- [ ] 桌面/移动端导航均渲染「小密室」，`href`/`target`/`rel` 符合 PRD
- [ ] 「小密室」永不选中、不派发 `NAVIGATE_EVENT`、不改 hash；既有导航零回归
- [ ] 未配置 API 时「小密室」仍显示
- [ ] `nav-bar.test.tsx` 新用例与既有用例全绿；`pnpm lint && pnpm test` 全绿
- [ ] Spec 同步：实现 PR 内更新 `docs/product/spec/site-pages.md` 与 `docs/engineering/spec/frontend-bookstore.md`

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-09-13-secret-room-nav-link-prd.md`
- 站点页面 Spec（现态）：`docs/product/spec/site-pages.md`
- 前端 Spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 开发规范：`docs/engineering/frontend-rules.md`
