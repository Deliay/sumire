---
description: 棉花糖编辑器工具栏精简技术提案——MarkdownEditor 经 @uiw/react-md-editor 的 commandsFilter 按 command.name denylist 精确剔除 code/codeBlock/link/image 四命令（按钮与快捷键同源失效），共享组件一处收敛，后台主题描述与公开投递口径一致；新增 markdown-editor 单测，实现 PR 内同步前端/产品 spec
type: Fleeting
---

# 棉花糖编辑器工具栏精简 - 技术提案

**功能名称**: 棉花糖编辑器工具栏精简（Marshmallow Editor Toolbar Trim）
**关联 PRD**: `docs/product/requirements/draft/2026-11-01-marshmallow-editor-toolbar-trim-prd.md`
**技术提案版本**: v1.0
**创建日期**: 2026-11-01
**作者**: sumire workflow
**prd-branch**: `prd/marshmallow-editor-toolbar-trim`（需求总分支）
**feat-branch**: `feat/marshmallow-editor-toolbar-trim`（开发分支，实现时自需求总分支合入 main 后切出）

## 1. 概述

### 1.1 背景

棉花糖编辑器为共享封装 `apps/bookstore/features/markdown/MarkdownEditor.tsx`（`@uiw/react-md-editor`，`next/dynamic` + `ssr: false`），挂载于公开收集页（投递）与后台主题表单（描述）两处，未做工具栏定制，直接使用库默认 `getCommands()`。

`@uiw/react-md-editor@4.1.2`（package.json 声明 `^4.0.0`）默认工具栏命令序列（`commands/index.js` 的 `getCommands()`）为：

```
bold, italic, strikethrough, hr, title(分组 heading1–6), divider,
link, quote, code, codeBlock, comment, image, table, divider,
unorderedListCommand, orderedListCommand, checkedListCommand, divider, help
```

本期需移除其中四个命令（PRD F1）：

| 命令 | `command.name` | 按钮 title / aria-label | 快捷键（`keyCommand`） |
|------|----------------|--------------------------|------------------------|
| 行内代码 | `code` | Insert code | `ctrlcmd+j`（Ctrl/Cmd+J） |
| 代码块 | `codeBlock` | Insert Code Block | `ctrlcmd+shift+j` |
| 链接 | `link` | Add a link | `ctrlcmd+l` |
| 图片 | `image` | Add image | `ctrlcmd+k` |

（注：`code.execute` 对多行选区回退调用 `codeBlock.execute`，两者均在移除清单内，无遗漏路径。）

### 1.2 目标

- `MarkdownEditor` 工具栏剔除 `code` / `codeBlock` / `link` / `image` 四个命令，按钮与快捷键同源失效；
- 其余命令（含 `comment`、`table`、列表、`help`）与编辑/预览/只读行为零回归；
- 单一共享组件一处收敛，两处使用点行为一致；单测先行覆盖过滤口径。

### 1.3 范围

- **做**：`MarkdownEditor.tsx` 命令过滤 + `apps/bookstore/tests/unit/markdown-editor.test.tsx` 新增用例；上线 PR 内同步 spec。
- **不做**：API/契约/数据库变更；语法级内容过滤（手输/粘贴语法不拦截）；工具栏按钮重排或视觉改版；`MarkdownView` 渲染层变更；按场景区分工具栏口径。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph TD
    PUB[TopicPublicPage<br/>公开投递] --> MDE[MarkdownEditor.tsx<br/>共享封装]
    ADMIN[TopicFormDialog<br/>后台主题描述] --> MDE
    MDE -->|commandsFilter| EDI[MDEditor<br/>@uiw/react-md-editor]
    EDI --> STORE[Context 命令列表<br/>state.commands]
    STORE --> BAR[工具栏渲染]
    STORE --> KEY[快捷键分发]
    FILT["filterEditorCommand<br/>denylist: code/codeBlock/link/image"] -.->|剔除四命令| STORE
    BAR -.->|不再渲染| BTN[代码/代码块/link/图片]
    KEY -.->|不再生效| SC[Ctrl+J / Ctrl+Shift+J<br/>Ctrl+L / Ctrl+K]
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js + React（既有） | 仅 `MarkdownEditor.tsx` 客户端组件内扩展 |
| 编辑器 | `@uiw/react-md-editor` 4.x（既有） | `MDEditorProps.commandsFilter` 命令过滤 API |
| 测试 | Vitest + Testing Library（既有） | 新增 `markdown-editor.test.tsx` |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `apps/bookstore/features/markdown/MarkdownEditor.tsx` | 工具栏命令过滤 | `commandsFilter` + `command.name` denylist；导出纯函数供单测 |
| `apps/bookstore/tests/unit/markdown-editor.test.tsx` | 单测覆盖 | 过滤口径 / extraCommands 不误伤 / 只读透传 |

## 3. API 设计

无 API 变更，无契约变更。

## 4. 数据模型

无数据模型变更。命令 denylist 为组件模块级常量，无持久化。

## 5. 技术实现方案

### 5.1 核心流程

`MDEditor` 初始化时对命令数组逐项调用 `commandsFilter`，返回 `false` 的命令被剔除后才进入 Context 命令列表（`Editor.factory.js`：`commands.map(commandsFilter).filter(Boolean)`，`extraCommands` 同样处理并以 `isExtra=true` 传入）。工具栏渲染与快捷键分发均消费同一命令列表，因此**按钮与快捷键在一处过滤后同源失效**，无需另行拦截键盘事件。

### 5.2 关键实现点

#### 实现点 1: 命令过滤（MarkdownEditor.tsx）

- 导出模块级常量与纯函数（供单测直接引用）：

  ```ts
  export const HIDDEN_COMMAND_NAMES = ["code", "codeBlock", "link", "image"] as const;

  export function filterEditorCommand(
    command: { name?: string },
    isExtra: boolean,
  ): false | { name?: string } {
    if (!isExtra && command.name && HIDDEN_COMMAND_NAMES.includes(command.name as never)) {
      return false;
    }
    return command;
  }
  ```

  传入 `<MDEditor commandsFilter={filterEditorCommand} … />`（类型按 `MDEditorProps["commandsFilter"]` 对齐 `ICommand`）；
- **匹配必须是 `command.name` 精确匹配**：`commandsFilter` 同样作用于 `extraCommands`（`isExtra=true`），其默认项 `codeEdit` / `codeLive` / `codePreview` 的 name 以 `code` 开头——前缀/包含匹配会误伤预览模式切换按钮；`isExtra` 分支双保险（extraCommands 恒不剔除）；
- `title` 是内含 heading1–6 的分组命令（`name: "title"`），过滤仅作用于顶层命令数组，分组内项不受影响，本期无需处理；
- **风险点**: 过滤依赖 `command.name` 这一库的稳定标识（`commands/code.js` 等导出对象的 `name` 字段），库升级大版本时可能变化——单测对真实 `getCommands()` 全量断言，作为升级回归网（见 §8）。

#### 实现点 2: 单元测试（markdown-editor.test.tsx）

- 导出的 `filterEditorCommand` 纯函数直接断言：四个 name 返回 `false`；其余（bold/italic/title/comment/table/help…）返回原对象；`isExtra=true` 时一律放行；
- 集成断言：`vi.mock("@uiw/react-md-editor")` stub 捕获 `commandsFilter` props，渲染 `MarkdownEditor`，对**真实** `getCommands()`（`import { getCommands, getExtraCommands } from "@uiw/react-md-editor/lib/commands"`，不走 `lib/index` 以免引入 `.less`）逐项过 `commandsFilter`，断言：
  - 过滤结果不含 `name` 为 `code`/`codeBlock`/`link`/`image` 的命令；
  - 其余默认命令全部保留（数量与 name 集合比对）；
  - `getExtraCommands()` 全量保留（`codeEdit`/`codeLive`/`codePreview`/`fullscreen` 不被 `code` 前缀误伤）；
  - 过滤结果不含 `keyCommand` 为 `code`/`codeBlock`/`link`/`image` 的命令（快捷键同源失效的可断言投影）；
- 透传回归：`readOnly` 时 `hideToolbar` 为 true、`preview="preview"`；非只读 `hideToolbar` 为 false（既有行为不回归）。

#### 实现点 3: Spec 同步（实现 PR 内）

- `docs/engineering/spec/frontend-bookstore.md`：`features/markdown/MarkdownEditor.tsx` 行补充工具栏过滤现态（`commandsFilter` 剔除 `code`/`codeBlock`/`link`/`image` 及其快捷键）；
- `docs/product/spec/topics.md`：公开收集页/主题描述的 Markdown 能力口径补一句（工具栏不含代码/代码块/图片/链接按钮）；
- 根 `AGENTS.md` 无需变更（不涉及结构与约定）。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 过滤方式 | `commandsFilter` denylist 剔除四命令 | 显式 `commands` 白名单重建工具栏 | A | 改动最小；默认命令序列仍由库维护，库小版本新增按钮自动保留；白名单需复制默认序列，升级时静默丢新按钮 |
| 生效层级 | 共享 `MarkdownEditor` 组件一处收敛 | 仅公开投递页过滤、主题描述保留 | A | 两处工具栏此前即同口径（棉花糖域实现计划 §4.3/§5.2）；组件级收敛保证一致、只改一处；如未来需差异化再加 props |
| 快捷键处理 | 随 `commandsFilter` 同源剔除 | 额外 keydown 拦截 | A | 过滤发生在命令进入 Context 列表之前，工具栏与快捷键共用该列表，无需额外键盘事件处理 |
| 命令识别 | `command.name` 精确匹配 denylist | 命令对象 identity 比较（`commands.code` 等） | A | 封装内不依赖各命令的导出路径；name 为命令对象公开标识且与 `keyCommand` 一一对应；identity 比较需额外 import 四个命令对象，收益仅是防改名（由 §8 单测兜底） |
| 移除后视觉 | 保留既有 divider 序列 | 移除后重排/收敛分隔符 | A（仅瑕疵时微调） | 移除四命令后默认序列不产生连续 divider；若实测出现视觉瑕疵再收敛，不提前过度设计 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | `@uiw/react-md-editor` 4.x | 既有依赖，`commandsFilter` 为 4.x 稳定 API；升级 5.x 需复核 |
| 约束 | TDD | 先补 `markdown-editor.test.tsx` 失败用例再实现 |
| 约束 | 前端规范 | `docs/engineering/frontend-rules.md`；`pnpm lint && pnpm test` 全绿 |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/marshmallow-editor-toolbar-trim` 需求总分支 |

## 7. 项目结构

```
apps/bookstore/
├── features/markdown/
│   └── MarkdownEditor.tsx        # HIDDEN_COMMAND_NAMES + filterEditorCommand + commandsFilter 传参
└── tests/unit/
    └── markdown-editor.test.tsx  # 新增：过滤口径 / extraCommands 不误伤 / 只读透传
docs/product/spec/topics.md                  # 实现 PR 内同步
docs/engineering/spec/frontend-bookstore.md  # 实现 PR 内同步
```

## 8. 测试策略

### 8.1 测试覆盖要求

`apps/bookstore/tests/unit/markdown-editor.test.tsx` 新增（先行失败再实现）：

- `filterEditorCommand` 对 `code`/`codeBlock`/`link`/`image` 返回 `false`，对其他 name 返回原对象；
- `isExtra=true` 时一律放行；
- 对真实 `getCommands()` 过滤后：不含四命令、其余默认命令全保留；
- 对真实 `getExtraCommands()` 过滤后全保留（`codeEdit`/`codeLive`/`codePreview` 不被误伤）；
- 过滤结果不含 `keyCommand` 为 `code`/`codeBlock`/`link`/`image` 的命令（快捷键同源失效）；
- 回归：`readOnly` / `hideToolbar` 透传行为不变，既有用例全绿。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library（jsdom） | 过滤函数、真实命令集过滤结果、只读透传、回归 |
| e2e | 不新增（可选） | 既有 `tests/e2e/src/bookstore/topics.spec.ts` 未断言工具栏；如需可在实现 PR 顺手补一条「工具栏无四按钮」断言（编辑器动态加载后按 `aria-label` 查询），不作为硬性要求 |

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
- [ ] 公开收集页与后台主题表单编辑器工具栏均不含「代码」「代码块」「link」「图片」按钮
- [ ] 四命令快捷键（Ctrl/Cmd+J / Ctrl+Shift+J / Ctrl+L / Ctrl+K）不再插入语法，其余快捷键不受影响
- [ ] 其余工具栏按钮与编辑/预览/只读行为零回归
- [ ] `markdown-editor.test.tsx` 新用例与既有用例全绿；`pnpm lint && pnpm test` 全绿
- [ ] Spec 同步：实现 PR 内更新 `docs/product/spec/topics.md` 与 `docs/engineering/spec/frontend-bookstore.md`

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-11-01-marshmallow-editor-toolbar-trim-prd.md`
- 棉花糖域产品 Spec（现态）：`docs/product/spec/topics.md`
- 前端 Spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 棉花糖域实现计划（工具栏口径出处）：`docs/engineering/plans/2026-09-06-marshmallow-topics-impl-plan.md`
- 开发规范：`docs/engineering/frontend-rules.md`
