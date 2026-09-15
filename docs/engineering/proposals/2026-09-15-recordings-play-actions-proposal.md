---
description: 录播文件项操作按钮组技术提案——纯前端方案：RoomRecordingsGroup 文件行右侧的「下载」文字链替换为 split button（主按钮「播放」+ 下拉开关 + 含「下载」的菜单），菜单收起复用既有 useDismiss，播放复用既有 onToggleFile 手风琴单例，零新增依赖、零 API 变更
type: Fleeting
---

# 录播文件项操作按钮组 - 技术提案

**功能名称**: 录播文件项操作按钮组（Recording File Actions）
**关联 PRD**: `docs/product/requirements/draft/2026-09-15-recordings-play-actions-prd.md`
**技术提案版本**: v1.0
**创建日期**: 2026-09-15
**作者**: sumire workflow
**prd-branch**: `prd/recordings-play-actions`（需求总分支）
**feat-branch**: `feat/recordings-play-actions`（开发分支，实现时自需求总分支合入 main 后切出）

## 1. 概述

### 1.1 背景

录播页 `/recordings` 文件项现态（`apps/bookstore/features/recordings/RoomRecordingsGroup.tsx:103-133`）：文件名 `<button>`（点击经 `onToggleFile(file)` 内联手风琴展开 `FlvPlayerPanel`，单例归属 `RecordingsApp` 的 `openFile` state）+ 大小/时间 + 右侧裸「下载」`<a href download>`。需求要求将右侧「下载」改为按钮组：默认主按钮「播放」，右侧下拉开关，点击展开菜单后才显示「下载」。

站内已有可直接复用的先例：

- 浮层收起：`features/schedule/useDismiss.ts`（`useDismiss(ref, open, onClose)`，点击外部 + Esc 关闭）；
- 按钮组 + 下拉菜单交互：`features/danmaku/components/MarkReadButtonGroup.tsx`（`dropdownRef` + 外部点击关闭 + 绝对定位深色菜单，`aria-expanded` 门控）。

### 1.2 目标

- `RoomRecordingsGroup` 文件行右侧渲染 split button：「播放/收起」主按钮 + `▾` 下拉开关 + 菜单（仅「下载」）；
- 「播放」与文件名点击等效（同一 `onToggleFile` 通路），展开态由既有 `openFile` 单例驱动；
- 「下载」保持现态 URL 与 `<a download>` 行为，仅入口移入菜单。

### 1.3 范围

- **做**：`RoomRecordingsGroup` 操作区改造（可抽 `RecordingFileActions` 子组件）+ 单测/e2e 更新；实现 PR 内同步 spec。
- **不做**：播放器本体（时间跳转/全屏属并行需求 `feat/recordings-seek-fullscreen`，PR #135）；`FlvPlayerPanel` 内 MSE 降级下载按钮；`servers/api` / 契约 / 编排资源；新增依赖。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph LR
    subgraph 文件行（RoomRecordingsGroup）
        NAME[文件名 button<br/>onToggleFile]
        GROUP[RecordingFileActions<br/>split button]
        PLAY[主按钮 播放/收起]
        CARET[下拉开关 ▾]
        MENU[菜单：下载 a href download]
    end
    APP[RecordingsApp<br/>openFile 单例 state]
    PANEL[FlvPlayerPanel<br/>内联手风琴展开]
    UPSTREAM[录播服务<br/>recordings/:fileName]

    PLAY -->|onToggleFile(file)| APP
    NAME -->|onToggleFile(file)| APP
    APP -->|openFile 命中即展开| PANEL
    CARET -->|useDismiss 收起| MENU
    MENU -->|原生下载| UPSTREAM
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js 16 + React 19（既有） | 仅客户端组件内交互变更 |
| 图标 | `lucide-react`（既有依赖） | `Play` / `ChevronDown`（`Download` 可选），无新增依赖 |
| 浮层收起 | `useDismiss`（既有 hook） | 点击外部 + Esc，对齐 schedule 先例 |
| 测试 | Vitest + Testing Library；Playwright | 更新既有 recordings 用例 |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `apps/bookstore/features/recordings/RoomRecordingsGroup.tsx` | 文件行操作区改造 | 移除裸下载链，渲染按钮组 |
| `apps/bookstore/features/recordings/RecordingFileActions.tsx`（新增） | split button + 菜单 | 菜单 state、`useDismiss`、ARIA |
| `apps/bookstore/tests/unit/recordings-groups.test.tsx` | 用例更新 + 新增按钮组用例 | 下载断言移入菜单交互后 |
| `tests/e2e/src/bookstore/recordings.spec.ts` | e2e 更新 | 下载入口改为「展开菜单 → 点击下载」 |

## 3. API 设计

无本站 API 变更，无契约变更。下载仍消费既有上游端点 `GET {BASE}/api/b/live/:roomId/recordings/:fileName`（经既有 `recordingFileUrl(roomId, file.name)` 构造，`<a download>` 命中上游 `Content-Disposition: attachment`）。

## 4. 数据模型

无持久化变更。新增组件内 state 仅菜单开合 `menuOpen: boolean`，随文件项卸载即弃。

## 5. 技术实现方案

### 5.1 核心流程

- **渲染**：文件行右侧渲染 `<RecordingFileActions roomId file open={openFile?.name === file.name} onToggleFile={onToggleFile} />`；原裸「下载」`<a>` 删除。
- **播放/收起**：主按钮点击调用既有 `onToggleFile(file)`——与文件名点击完全同一通路，单例展开/折叠逻辑（含跨分组替换）由 `RecordingsApp` 既有 `openFile` 机制保证，本组件不新增任何播放状态；`open=true` 时主按钮文案「收起」（`aria-expanded` 同步），否则「播放」。
- **下拉菜单**：`▾` 开关切换 `menuOpen`；容器 `div.relative` + `useDismiss(containerRef, menuOpen, close)` 实现点击外部/Esc 关闭；菜单 `absolute right-0` 深色浮层（对齐 `MarkReadButtonGroup` 的菜单样式），内含「下载」`<a href={recordingFileUrl(roomId, file.name)} download>`，点击后经 `onClick` 顺手关闭菜单。

### 5.2 关键实现点

#### 实现点 1: RecordingFileActions 组件

- Props：`{ roomId: number; file: RecordingFile; open: boolean; onToggleFile: (file: RecordingFile) => void }`；纯受控展示组件，播放状态零自持；
- 主按钮：`type="button"`、`aria-expanded={open}`、文案 `open ? "收起" : "播放"`；下拉开关：`type="button"`、`aria-haspopup="menu"`（或 `true`）、`aria-expanded={menuOpen}`、`aria-label="更多操作"`；
- 菜单容器 `role="menu"`、下载项 `role="menuitem"`；样式沿用文件行 `text-tiny text-ink-dim hover:text-flower` 语义色与 `--color-flower` 焦点环，主按钮与开关置于同一 `rounded-full border border-vine` 容器内分段（中间 `border-l` 分隔），形成视觉一体的按钮组；
- **风险点**：菜单在文件行内绝对定位，父级 `overflow`/堆叠上下文可能裁剪——菜单 `z` 层级对齐站内浮层先例（如 `z-[80]`），实现期在目视检查移动端与末行文件的菜单展示。

#### 实现点 2: 与既有单例播放的联动

- 本需求不触碰 `RecordingsApp`/`FlvPlayerPanel`：展开他文件、播放器关闭按钮、MSE 降级等路径均经既有 `openFile` 变化传导，按钮态自动复位（`open` 由父级计算传入）；
- **风险点**：`FlvPlayerPanel` 的「关闭」按钮走 `onClosePlayer`，关闭后 `openFile` 置空，按钮组复位——已在既有单测覆盖范围内，本期仅需在按钮组用例中断言该复位。

#### 实现点 3: 既有用例的最小更新

- `recordings-groups.test.tsx`：现「下载」链接断言（href/download 属性）改为「点开 `▾` → 菜单内下载链接」断言，新增主按钮 toggle、Esc/外部点击关闭、展开态文案用例；其余分组折叠/分页/错误重试用例不动；
- `recordings.spec.ts`（e2e）：下载相关断言同样改为菜单交互后断言 `href`；
- 属接口变更的正常测试更新，不改无关用例。

#### 实现点 4: Spec 同步（实现 PR 内）

- `docs/product/spec/site-pages.md` F5 节：文件项操作区改为「播放/收起 + 下拉（下载）」按钮组现态描述；
- `docs/engineering/spec/frontend-bookstore.md` 录播节：`RoomRecordingsGroup` 描述补充按钮组与 `RecordingFileActions` 组件；
- 根 `AGENTS.md` 无需变更（无结构与契约变更）。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 播放入口实现 | 复用 `onToggleFile` 同一通路 | 按钮自持独立播放状态 | A | 单例播放逻辑已完备且被测试覆盖，双通路必然产生状态分叉 |
| 组件形态 | 抽 `RecordingFileActions` 子组件 | 全部内联在 `RoomRecordingsGroup` | A | 菜单 state/ARIA/关闭逻辑独立可测，`RoomRecordingsGroup` 行模板保持可读；组件小，不过度抽象 |
| 菜单收起 | 复用 `useDismiss` hook | 组件内自写监听 | A | 既有 hook 语义完全一致（点击外部 + Esc），复用对齐 schedule/danmaku 先例 |
| 下载实现 | 菜单内 `<a href download>` | 菜单内按钮 + JS 触发 | A | 与现态行为一致，命中上游 `Content-Disposition` 原生下载，无 JS 下载hack |
| 文件名点击行为 | 保持现状（仍可 toggle） | 移除，仅留按钮组 | A | PRD 明确双入口等效；移除既有交互属额外破坏面，本期不做 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | 既有 `onToggleFile`/`openFile` 单例机制 | `RecordingsApp` 现态，不变更 |
| 依赖 | `useDismiss` hook 与 `lucide-react` | 既有，无新增依赖 |
| 约束 | 并行需求 `feat/recordings-seek-fullscreen`（PR #135）在途 | 变更面无文件级重叠（其改 `FlvPlayerPanel`/`player.ts`，本需求改 `RoomRecordingsGroup`），合入顺序先后均可 |
| 约束 | TDD；`pnpm lint && pnpm test` 全绿 | 先测试后实现 |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/recordings-play-actions` → 合入 main 后切 `feat/recordings-play-actions` |

## 7. 项目结构

```
apps/bookstore/
├── features/recordings/
│   ├── RoomRecordingsGroup.tsx          # 改：文件行操作区 → 按钮组
│   └── RecordingFileActions.tsx         # 新增：split button + 下载菜单
├── tests/unit/
│   └── recordings-groups.test.tsx       # 改：下载断言移入菜单 + 新增按钮组用例
tests/e2e/src/bookstore/recordings.spec.ts  # 改：下载经菜单交互断言
docs/product/spec/site-pages.md             # 实现 PR 内同步（F5）
docs/engineering/spec/frontend-bookstore.md # 实现 PR 内同步（录播节）
```

## 8. 测试策略

### 8.1 测试覆盖要求

- **前端单测（Vitest）**：按钮组渲染（无裸下载链接）；主按钮「播放」→ `onToggleFile` 被调且 `open` 态文案「收起」；`▾` 展开菜单、菜单内下载链接 `href`/`download` 属性正确（含 `encodeURIComponent` 文件名）；点击下载后菜单关闭；点击外部与 Esc 关闭菜单；`openFile` 置空（播放器关闭）后按钮复位。
- **e2e（Playwright）**：沿用 `page.route` mock 上游；断言文件行无直接下载链接，展开菜单后下载链接 `href` 正确；主按钮点击后 `FlvPlayerPanel` 展开（桩断言同现态）。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library | 按钮组交互、菜单开合、下载链接、状态复位 |
| API 测试 | 不新增 | 无本站 API 变更（纯前端功能） |
| e2e | Playwright | 菜单交互与下载入口（mock 上游） |

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地联调 | 既有 Aspire 编排 | 无新增编排资源 |
| 生产 | 既有 bookstore SSG 发布 | 无新环境变量与流水线变更 |

### 9.2 配置管理

无新增配置。

## 10. 验收标准

- [ ] 技术方案评审通过
- [ ] 文件项操作区满足 PRD F1 全部验收标准（播放/收起、下拉菜单、下载、Esc/外部点击、ARIA）
- [ ] 既有录播页行为（分组折叠、分页、听直播、单例播放、MSE 降级）零回归
- [ ] `pnpm lint && pnpm test` 全绿；e2e 录播 spec 通过
- [ ] Spec 同步：`site-pages.md`、`frontend-bookstore.md`

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-09-15-recordings-play-actions-prd.md`
- 站点页面 Spec（现态）：`docs/product/spec/site-pages.md`
- 前端 Spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 开发规范：`docs/engineering/frontend-rules.md`
- 页面设计：`docs/design/02-page-design.md`
