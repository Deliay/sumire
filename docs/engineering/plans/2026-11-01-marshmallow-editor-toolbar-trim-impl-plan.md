---
description: 棉花糖编辑器工具栏精简与默认实时预览实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/marshmallow-editor-toolbar-trim，唯一开发分支 feat/marshmallow-editor-toolbar-trim。纯前端单点变更：MarkdownEditor 导出 HIDDEN_COMMAND_NAMES + filterEditorCommand（commandsFilter 按 command.name 精确剔除 code/codeBlock/link/image，按钮与快捷键同源失效），非只读默认 preview="live"（只读维持 preview="preview"）；新增 markdown-editor 单测（纯函数 / 真实 getCommands 与 getExtraCommands / 组件 prop 透传），实现 PR 内同步产品与工程 spec。
type: Permanent
---

# 棉花糖编辑器工具栏精简与默认实时预览实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-11-01-marshmallow-editor-toolbar-trim-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-11-01-marshmallow-editor-toolbar-trim-proposal.md]]（v1.0）
**需求总分支**: `prd/marshmallow-editor-toolbar-trim`（需求总 PR：<https://github.com/Deliay/sumire/pull/152>）
**开发分支**: `feat/marshmallow-editor-toolbar-trim`（自需求总分支切出，**唯一开发分支**，实现/单测/spec 同步全部同在此分支）
**版本**: v1.0（2026-11-01）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD（先补失败用例再实现）。变更仅为 `apps/bookstore` 单点前端改动：共享组件 `MarkdownEditor` 一处收敛，公开投递与后台主题描述两处使用点同步生效；无 API、契约、数据模型、编排与环境变量变更。

> **分支口径说明**：提案头部写「feat 分支实现时自需求总分支合入 main 后切出」，与仓库既有迭代口径不一致。既有迭代（如录播优化一期 #135→#134、录播播放优化 #147→#146）实际执行顺序为：`feat` 分支自需求总分支切出 → feat PR 回合需求总分支 → 需求总分支合入 main。本方案沿用既有口径，自 `prd/marshmallow-editor-toolbar-trim` 切出 feat 分支，完成后 PR 回合该需求总分支。

## 1. 前提事实（已在需求总分支 `f92f143` 核对）

### 1.1 代码现态

- `apps/bookstore/features/markdown/MarkdownEditor.tsx`（38 行）：`"use client"` + `next/dynamic` 动态加载 `@uiw/react-md-editor`（`ssr: false`，加载骨架 `min-h-[10rem]`）；props `{ value, onChange, readOnly = false, minHeight = "10rem" }`；当前 `const preview = readOnly ? "preview" : "edit";`（:25），`hideToolbar={readOnly}`、`visibleDragbar={!readOnly}`（:33-34），`height={minHeight}`；未传 `commands` / `commandsFilter`。
- 两处使用点：
  - 公开投递 `features/topics/components/TopicPublicPage.tsx:127-132`：`readOnly={viewState === "submitting" || !isCollecting}`、`minHeight="12rem"`；未开始/已结束/未归档进行中时也渲染编辑器（只读纯预览）。
  - 后台主题表单 `features/topics/components/TopicFormDialog.tsx:109-113`：仅传 `value`/`onChange`/`minHeight="10rem"`，非只读。
- `MarkdownView` 渲染层（`features/markdown/MarkdownView.tsx`）本期零改动，历史含链接/图片/代码内容按现态渲染。

### 1.2 依赖库事实（`@uiw/react-md-editor@4.1.2`，lockfile 定版；`^4.0.0`）

- 默认命令序列 `getCommands()`：`bold, italic, strikethrough, hr, title(分组 heading1–6), divider, link, quote, code, codeBlock, comment, image, table, divider, unorderedListCommand, orderedListCommand, checkedListCommand, divider, help`。
- 四个待移除命令的稳定标识（`command.name` / `keyCommand` / 快捷键 / `aria-label`）逐项核对：

  | 命令 | `name` | `keyCommand` | 快捷键 | 按钮 `aria-label` |
  |------|--------|--------------|--------|-------------------|
  | 行内代码 | `code` | `code` | `ctrlcmd+j` | Insert code (ctrl + j) |
  | 代码块 | `codeBlock` | `codeBlock` | `ctrlcmd+shift+j` | Insert Code Block (ctrl + shift + j) |
  | 链接 | `link` | `link` | `ctrlcmd+l` | Add a link (ctrl + l) |
  | 图片 | `image` | `image` | `ctrlcmd+k` | Add image (ctrl + k) |

- `MDEditorProps.commandsFilter?: (command: ICommand, isExtra: boolean) => false | ICommand`；`Editor.factory` 对 `commands` 与 `extraCommands` 分别 `map(commandsFilter).filter(Boolean)` 后写入 Context。
- 工具栏渲染与快捷键分发（`components/TextArea/shortcuts.js`）均消费**过滤后的同一命令列表**：剔除命令后按钮消失、快捷键同步失效，无需额外 `keydown` 拦截。
- `extraCommands` 默认为 `[codeEdit, codeLive, codePreview, divider, fullscreen]`，**实际 `name` 为 `edit` / `live` / `preview` / `fullscreen`**（不是 `codeEdit`/`codeLive`/`codePreview`）。提案 §5.2 实现点 1 此处描述有误，但 denylist 为精确匹配且带 `isExtra` 分支，无功能影响；本方案以实际值锁定单测。
- `preview` prop 类型 `PreviewType = "edit" | "live" | "preview"`；库缺省为 `live`，但当前封装显式传 `edit`。prop 变化会同步到编辑器内部状态（`Editor.factory` 对 `previewType` 变化 dispatch），因此提交中切只读仍能切到纯预览。
- 包 `exports` 暴露 `./commands` 子路径（`esm/commands/index.js` + `lib/commands/index.d.ts`，无 CSS 副作用）：单测取真实命令集应 `import { getCommands, getExtraCommands } from "@uiw/react-md-editor/commands"`。**提案 §8.1 写的 `@uiw/react-md-editor/lib/commands` 不在 exports 映射内**，Vite/Vitest 会报 `ERR_PACKAGE_PATH_NOT_EXPORTED`，实现时改用官方子路径。

### 1.3 测试设施现态

- `apps/bookstore/vitest.config.ts`：默认 `environment: "node"`，`include: tests/unit/**/*.test.{ts,tsx}`，alias `@` → 应用根；jsdom 用例在文件首行加 `// @vitest-environment jsdom`（先例 `tests/unit/footer-link.test.tsx:1`）。
- `tests/unit/` 下**尚无** `MarkdownEditor` / `markdown` 相关用例；既有 100 个单测文件用 Testing Library + `cleanup`。
- `vitest.setup.ts` 已提供 `ResizeObserver` 最小 mock；项目无 `next/dynamic` 的单测 mock 先例。
- e2e `tests/e2e/src/backdoor/topics.spec.ts` 覆盖后台建主题 → 公开投递 → 详情采用 → 幻灯片链路，但未断言编辑器工具栏；本期不强制新增 e2e（见 §4）。

### 1.4 文档同步位置

- `docs/engineering/spec/frontend-bookstore.md:175`：`MarkdownEditor` 行现为「@uiw/react-md-editor 封装（`next/dynamic ssr:false`）」。
- `docs/product/spec/topics.md`：`## 棉花糖投递` 节（编辑器能力口径宜落在此处）；后台主题描述口径与公开投递同属共享组件。
- `apps/bookstore/AGENTS.md`：无 `features/markdown` 专节，本次行为已被 spec 收录，无需改写；根 `AGENTS.md` 无变更。

## 2. 变更面

| 文件 | 变更 | 说明 |
|------|------|------|
| `apps/bookstore/features/markdown/MarkdownEditor.tsx` | 新增 `HIDDEN_COMMAND_NAMES` / `filterEditorCommand`，传 `commandsFilter`；非只读默认 `preview="live"` | 唯一实现改动点，两处使用点共享 |
| `apps/bookstore/tests/unit/markdown-editor.test.tsx` | 新增单测（jsdom） | 纯函数 / 真实命令集 / 组件 prop 透传 / 只读回归 |
| `docs/engineering/spec/frontend-bookstore.md` | 补 `MarkdownEditor` 现态口径 | 实现 PR 内同步 |
| `docs/product/spec/topics.md` | 补「Markdown 编辑器」口径（两处一致） | 实现 PR 内同步 |

不做：API/契约/数据库/编排；语法级内容过滤（手输/粘贴仍可渲染）；工具栏重排或视觉改版；`MarkdownView` 变更；按场景拆工具栏；窄屏默认单列策略（PRD §六后续项）。

## 3. 实施步骤（TDD）

### 步骤 0：切开发分支

自 `prd/marshmallow-editor-toolbar-trim` 切出 `feat/marshmallow-editor-toolbar-trim` 并推送。

**验证**：`git branch --show-current` 为 `feat/marshmallow-editor-toolbar-trim`；`git log --oneline -1` 为需求总分支最新提交（含本实现方案）。

### 步骤 1：单测先行（红）

新增 `apps/bookstore/tests/unit/markdown-editor.test.tsx`（`// @vitest-environment jsdom`），按三层组织：

1. **纯函数层**：从组件导入 `HIDDEN_COMMAND_NAMES` / `filterEditorCommand`，断言：
   - `code` / `codeBlock` / `link` / `image` 返回 `false`；
   - 其他 name（`bold`/`italic`/`title`/`comment`/`table`/`help` 等）返回**原对象**（`toBe`）；
   - `isExtra=true` 时即使 name 命中 denylist 也原样放行。
2. **真实命令集层**（防库升级漂移的回归网）：
   - `import { getCommands, getExtraCommands } from "@uiw/react-md-editor/commands"`；
   - 先断言 `getCommands()` 中命中 denylist 的命令恰为 4 个（防空跑）；
   - 过滤结果不含四个 name，且**其余默认命令全保留**（与「原始序列剔除四命令」逐项比对 name/顺序，含 `divider` 无 name 项）；
   - 过滤结果不含 `keyCommand` 为 `code`/`codeBlock`/`link`/`image` 的命令（快捷键同源失效的可断言投影）；
   - `getExtraCommands()` 全量保留，`name` 集合含 `edit` / `live` / `preview`（视图切换不被误伤），`fullscreen` 保留；
   - 过滤结果中不存在四个被移除按钮的 `aria-label`（PRD「按 aria-label 断言」的数据层投影）。
3. **组件透传层**（`vi.mock("next/dynamic")` 返回同步 stub，stub 内用 `vi.hoisted` 捕获 props，工厂不写 JSX，规避动态加载抖动）：
   - 非只读：捕获的 `preview === "live"`、`hideToolbar === false`、`visibleDragbar === true`、`commandsFilter === filterEditorCommand`；
   - `readOnly`：捕获的 `preview === "preview"`、`hideToolbar === true`、`visibleDragbar === false`；
   - 把捕获的 `commandsFilter` 作用于真实命令集，断言过滤结果与纯函数层一致（证明组件确实把过滤器交给了库）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/markdown-editor.test.tsx` 因导出/行为缺失而失败（红），失败原因符合预期（非环境/语法错误）。

### 步骤 2：实现（绿）

`apps/bookstore/features/markdown/MarkdownEditor.tsx`：

```tsx
import type { ICommand } from "@uiw/react-md-editor";

export const HIDDEN_COMMAND_NAMES: ReadonlySet<string> = new Set([
  "code",
  "codeBlock",
  "link",
  "image",
]);

export function filterEditorCommand(
  command: ICommand,
  isExtra: boolean,
): false | ICommand {
  if (!isExtra && command.name && HIDDEN_COMMAND_NAMES.has(command.name)) {
    return false;
  }
  return command;
}

// …
const preview = readOnly ? "preview" : "live";
// …
<MDEditor
  value={value}
  onChange={(val) => onChange(val ?? "")}
  preview={preview}
  height={minHeight}
  visibleDragbar={!readOnly}
  hideToolbar={readOnly}
  commandsFilter={filterEditorCommand}
/>
```

要点：

- 匹配用 `command.name` **精确** denylist（`Set.has`），不得用前缀/包含匹配；`isExtra` 分支双保险，`edit`/`live`/`preview`/`fullscreen` 恒放行；
- `import type` 仅取类型，编译期擦除，不引入运行时依赖/CSS；
- `title` 为分组命令，过滤只作用于顶层数组，组内 heading1–6 不受影响；
- 不额外拦截键盘事件（过滤已在命令进入 Context 前完成）；
- 不新增依赖、不改 `MarkdownView`、不动两处使用点调用签名。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/markdown-editor.test.tsx` 全绿；`pnpm -C apps/bookstore lint` 通过。

### 步骤 3：全量验证

`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿（build 含缩略图与 original webp 前置，SSG 输出与既有页面无差异）。

### 步骤 4：手工验证（Aspire 编排）

`cd infra/aspire && aspire start` 后逐项：

1. **公开投递**（`/topics?id={进行中主题}`）：非只读编辑器默认「Live code」左右分屏，输入即时渲染；工具栏无「代码/代码块/link/图片」四个按钮，其余按钮（加粗/斜体/删除线/标题/引用/列表/表格/帮助）在且可用；
2. **快捷键**：编辑区内 Ctrl/Cmd+J、Ctrl/Cmd+Shift+J、Ctrl/Cmd+L、Ctrl/Cmd+K 不插入语法；Ctrl/Cmd+B 加粗、Ctrl/Cmd+7/8/9 视图切换仍生效；
3. **视图切换**：手动切 Edit code / Live code / Preview code 正常；提交中（`submitting`）切只读纯预览、工具栏隐藏；未开始/已结束主题同样纯预览；
4. **后台主题表单**（`/backdoor/topics` 新建/修改）：默认 Live code 分屏、工具栏同口径；
5. **历史内容与手输语法**：既有含链接/图片/代码的内容在 `MarkdownView` 渲染零回归；手动键入 `![](url)`、`` `code` `` 仍可输入并渲染（本期不做内容过滤）；
6. **窄屏**：移动端/弹窗内分屏拥挤属已知边界（PRD §3.4/§六），沿用库默认表现，不在本期改响应式模式。

**验证**：以上 6 项逐条通过并记录于 PR 描述/评论。

### 步骤 5：Spec 同步与收尾

1. `docs/engineering/spec/frontend-bookstore.md:175` 的 `MarkdownEditor` 行改为现态：
   「@uiw/react-md-editor 封装（`next/dynamic ssr:false`）；`commandsFilter` 按 `command.name` 精确剔除 `code`/`codeBlock`/`link`/`image`（按钮与快捷键同源失效）；非只读默认 `preview="live"`（Live code 分屏实时预览），只读 `preview="preview"` 且隐藏工具栏」
2. `docs/product/spec/topics.md` 在「棉花糖投递」节补编辑器口径（公开收集页与后台主题描述同口径）：
   「编辑器工具栏不含「代码」「代码块」「图片」「链接」按钮（对应快捷键 Ctrl/Cmd+J、Ctrl/Cmd+Shift+J、Ctrl/Cmd+L、Ctrl/Cmd+K 同步失效）；非只读默认 Live code（编辑 + 预览分屏实时预览），可手动切换 Edit code / Live code / Preview code；只读态（投递中/主题未开始/已结束）维持纯预览；手输/粘贴的链接、图片、代码语法仍按原样渲染。」
3. 核对本方案 §2 变更面与 PRD §1.3 成功标准、§3.2 验收标准、提案 §10 验收清单逐项通过；
4. 推送 `feat/marshmallow-editor-toolbar-trim`，提 PR 回合 `prd/marshmallow-editor-toolbar-trim`（需求总 PR #152 随之更新）；不改动需求总分支上的 PRD/提案原文（时点文档只追加实现方案）。

**验证**：workspace 级 `pnpm lint && pnpm test` 全绿 + `pnpm -C apps/bookstore build` 通过；两份 spec diff 可见；PR 描述含手工验证清单。

## 4. 测试与验收对照

| PRD 成功标准 | 覆盖方式 |
|--------------|---------|
| 公开收集页工具栏不含四按钮（aria-label） | 组件透传 + 真实命令集过滤断言（`aria-label` 投影）；步骤 4 手工确认 |
| 后台主题表单同口径 | 共享组件一处收敛；步骤 4 手工确认 |
| 四快捷键失效、其余快捷键不受影响 | 过滤后 `keyCommand` 集合断言（同源失效）；步骤 4 手工确认 Ctrl+B 与 Ctrl+7/8/9 |
| 两处默认 Live code 分屏 | 组件 `preview==="live"` 断言；步骤 4 手工确认分屏渲染 |
| 视图切换三模式仍可用 | `getExtraCommands()` 全量保留断言（`edit`/`live`/`preview`）；步骤 4 手工切换 |
| 只读态仍纯预览 | `readOnly` 用例断言 `preview="preview"` + `hideToolbar=true`；步骤 4 提交中/未开始/已结束确认 |
| 其余工具栏按钮功能不变 | 过滤结果与「默认序列剔除四命令」逐项比对；步骤 4 手工确认 |
| 历史链接/图片/代码渲染零回归 | `MarkdownView` 零改动 + 既有单测/e2e 回归 |

测试类型：仅单元测试（Vitest + Testing Library）。不新增 e2e（提案 §8.2 亦为可选项）：本次为共享组件内部口径，真实命令集断言已覆盖按钮与快捷键的数据源，e2e 需等动态编辑器加载后按 `aria-label` 查询，收益低且易抖动；既有 `topics.spec.ts` 链路回归即可。

## 5. 风险与边界

- **库升级漂移**：过滤依赖 `command.name` 稳定标识。单测对真实 `getCommands()`/`getExtraCommands()` 全量断言，库大版本升级时改名/改序列会立即红；`@uiw/react-md-editor@5.x` 需复核 `commandsFilter` 与命令 `name`。
- **测试动态加载抖动**：组件经 `next/dynamic` 加载，jsdom 下异步解析可能产生 `act` 警告/flaky。方案用 `vi.mock("next/dynamic")` 返回同步 stub 捕获 props；若实现时该 mock 与 Next 16 内部形状冲突，退路为 mock `@uiw/react-md-editor` 并以 `await screen.findByTestId` 等待动态加载完成（不改生产代码）。
- **子路径导入**：单测必须走 `@uiw/react-md-editor/commands`（官方 exports 子路径）；不得使用提案中的 `lib/commands` 深路径。
- **窄屏分屏拥挤**：默认 Live code 使移动端/后台弹窗内可用宽度变窄，PRD 已认可沿用库默认并列为后续项；本期不引入 `useMediaQuery` 响应式判定。
- **入口收敛非内容封锁**：移除按钮不拦截手输/粘贴语法，安全兜底仍以 AI 审核与内容复核为准（PRD §4.2）；不得在实现中扩大为语法级过滤。
- **范围纪律**：不重排/不新增工具栏按钮，不动 `MarkdownView`，不按使用点拆分工具栏口径，不改 API/契约/编排。

## 6. 相关文档

- PRD：[[../../product/requirements/draft/2026-11-01-marshmallow-editor-toolbar-trim-prd.md]]
- 技术提案：[[../proposals/2026-11-01-marshmallow-editor-toolbar-trim-proposal.md]]
- 棉花糖域实现计划（工具栏口径出处）：[[2026-09-06-marshmallow-topics-impl-plan.md]]
- 产品 Spec（现态）：`../../product/spec/topics.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 开发规范：[[../frontend-rules.md]]
- 需求总 PR：<https://github.com/Deliay/sumire/pull/152>
