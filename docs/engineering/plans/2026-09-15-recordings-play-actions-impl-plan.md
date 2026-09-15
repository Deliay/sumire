---
description: 录播文件项操作按钮组实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/recordings-play-actions，唯一开发分支 feat/recordings-play-actions，纯前端变更（仅 apps/bookstore + tests/e2e），无契约/后端/编排/依赖变更。TDD 串行推进：RecordingFileActions 按钮组单测先行（播放/收起 toggle、菜单开合、下载链接、Esc/外部点击、复位）→ 组件实现并接入 RoomRecordingsGroup（移除裸下载链）→ 既有用例最小更新（flv-player-panel 下载断言移入菜单交互、e2e 下载用例经菜单断言）→ spec 同步收尾（site-pages.md F5、frontend-bookstore.md 录播节）。
type: Permanent
---

# 录播文件项操作按钮组实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-15-recordings-play-actions-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-15-recordings-play-actions-proposal.md]]（v1.0）
**需求总分支**: `prd/recordings-play-actions`（需求总 PR：<https://github.com/Deliay/sumire/pull/136>）
**开发分支**: `feat/recordings-play-actions`（自需求总分支切出，**唯一开发分支**，实现/单测/e2e/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-15）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD（先补失败用例再实现）。纯前端交互变更：无契约、无 `servers/api`、无编排资源、无新增运行时依赖；播放复用既有 `onToggleFile`/`openFile` 手风琴单例通路，菜单收起复用既有 `useDismiss` hook。

**前提事实**（已在需求总分支 `prd/recordings-play-actions` 核对代码现态，commit 710b0d2）：

- 文件行现态：`apps/bookstore/features/recordings/RoomRecordingsGroup.tsx:103-133`——每文件行内 `open = openFile?.name === file.name`（`:104`）；文件名 `<button onClick={() => onToggleFile(file)} aria-expanded={open}>`（`:108-117`，保持不动）；大小/时间（`:118-121`）；右侧裸「下载」`<a href={recordingFileUrl(roomId, file.name)} download>`（`:122-128`）即本期唯一移除点；播放器 `open && <FlvPlayerPanel ... onClose={onClosePlayer} />`（`:130`）不动。
- 单例播放通路现态：`apps/bookstore/features/recordings/RecordingsApp.tsx:23-27` `toggleFile` 同文件再点置 null、异文件替换（跨分组经 `:49` 按 roomId 过滤 `openFile`）；播放器「关闭」按钮走 `onClosePlayer`（`:51`）置空——按钮组「收起」态完全由父级传入的 `open` 派生，组件零自持播放状态。
- 浮层收起先例：`apps/bookstore/features/schedule/useDismiss.ts:6-26`——`useDismiss(ref, open, onClose)`，`open` 为真时挂 `document` 级 `mousedown`（外部点击）+ `keydown`（Esc）监听，语义与本期需求完全一致，直接复用。
- 按钮组 + 菜单样式先例：`apps/bookstore/features/danmaku/components/MarkReadButtonGroup.tsx:85-124`——容器 `div.relative` + `dropdownRef`，菜单 `absolute right-0 z-[80] mt-1 min-w-[10rem] rounded-md border border-vine/50 bg-raised shadow-xl`，`aria-expanded` 门控渲染；本期菜单浮层对齐该样式与 z 层级。
- 既有单测下载断言位置：`apps/bookstore/tests/unit/flv-player-panel.test.tsx:257-264`（「文件项『下载』链接与播放同源且文件名经编码」，`screen.getByRole("link", { name: /下载/ })` 直取）——本期改为「展开 `▾` 菜单后取链接」；`:222-235` 的 isSupported 降级用例断言的是 `FlvPlayerPanel` **内部**下载按钮（`within(panel)`），不在本期变更面，不动。
- 分组用例现态：`apps/bookstore/tests/unit/recordings-groups.test.tsx`（187 行，6 用例）渲染 `RecordingsApp` 整机并 mock `@/features/recordings/api` 与 `mpegts.js`（`:6-40`）——按钮组新用例复用该 mock 设施，经「展开分组 → 点击播放/▾」驱动。
- e2e 下载断言位置：`tests/e2e/src/bookstore/recordings.spec.ts:115-124`（`page.getByRole("link", { name: "下载" }).first()` 直取 href/download）——本期改为「点 `▾` → 菜单内链接」断言；`:126-139` 的 preview 用例经文件名点击展开播放器，文件名双入口保留，不动。
- 图标依赖现态：`RoomRecordingsGroup.tsx:4` 已引 `lucide-react`（`ChevronDown`/`ChevronRight`），按钮组所需 `Play` 同包引入，零新增依赖。
- 菜单卸载兜底：翻页（`pageFiles` slice，`:64`）与分组折叠（`expanded &&` 门控，`:81`）均使文件行卸载，组件内 `menuOpen` state 随之销毁——「菜单展开中翻页/折叠无残留浮层」由 React 卸载天然保证，无需额外处理，但需单测锁定。
- Spec 同步位置：`docs/product/spec/site-pages.md:61` F5 节末尾「每个文件项提供『下载』`<a href download>`」一句需改写为按钮组现态；`docs/engineering/spec/frontend-bookstore.md:63` 组件清单中 `RoomRecordingsGroup` 描述需补按钮组与新增 `RecordingFileActions`；`apps/bookstore/AGENTS.md:84` 录播页约定的组件枚举同步补 `RecordingFileActions`；根 `AGENTS.md` 无变更。

整体顺序（**串行**，唯一开发分支 `feat/recordings-play-actions`）：
**切开发分支 → 按钮组单测先行（红）→ RecordingFileActions 实现 + RoomRecordingsGroup 接入（绿）→ 既有单测/e2e 下载断言最小更新 → e2e 运行 → spec 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 文件行操作区 | 右侧裸「下载」`<a href download>`（`RoomRecordingsGroup.tsx:122-128`） | 替换为 split button：主按钮「播放/收起」+ `▾` 下拉开关 + 菜单（仅「下载」`<a href download>`），抽 `RecordingFileActions` 子组件 |
| 播放入口 | 仅文件名点击（隐式） | 「播放」主按钮与文件名点击同走 `onToggleFile(file)` 通路（双入口等效），`open` 态文案「收起」、`aria-expanded` 同步 |
| 菜单开合 | 无 | 组件内 `menuOpen` state + `useDismiss(containerRef, menuOpen, close)`（点击外部 + Esc），点击「下载」后顺手关闭 |
| ARIA | 文件名按钮 `aria-expanded` | 主按钮 `aria-expanded={open}`；开关 `aria-haspopup="menu"` + `aria-expanded={menuOpen}` + `aria-label="更多操作"`；菜单 `role="menu"`、下载项 `role="menuitem"` |
| 单测 | 下载直取断言（`flv-player-panel.test.tsx:257-264`） | 改为菜单交互后断言；新增按钮组渲染/toggle/开合/复位用例 |
| e2e | 下载直取断言（`recordings.spec.ts:115-124`） | 改为「点 `▾` → 菜单内链接 href/download」断言；新增主按钮展开播放器断言 |
| 文档 | spec 记录裸下载链接现态 | 同 PR 同步 `site-pages.md:61`、`frontend-bookstore.md:63`、`apps/bookstore/AGENTS.md:84`；根 `AGENTS.md` 无变更 |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/recordings-play-actions`；
- 开发工作（实现 + 单测 + e2e + spec 同步）在**唯一开发分支** `feat/recordings-play-actions` 上进行（自 `prd/recordings-play-actions` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步；
- 开发前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`；前端规则要点：全部页面 SSG、业务组件放 `features/<模块>/`、样式只用 `@theme` token 色禁硬编码、提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/recordings-play-actions` 切出 `feat/recordings-play-actions` 并推送。

**验证**：`git branch --show-current` 为 `feat/recordings-play-actions`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：按钮组单测先行（红）

新增 `apps/bookstore/tests/unit/recording-file-actions.test.tsx`（jsdom），直接渲染 `RecordingFileActions` 纯受控组件（props 桩：`roomId`、`file`、`open` 布尔、`onToggleFile` spy），复用 `recordings-groups.test.tsx:6-40` 的 api mock 范式（仅需 `recordingFileUrl`）：

1. 渲染：主按钮文案「播放」（`open=false`）/「收起」（`open=true`），`aria-expanded` 与 `open` 同步；下拉开关存在且带 `aria-haspopup`/`aria-expanded="false"`/`aria-label="更多操作"`；**默认无「下载」链接**（`queryByRole("link", { name: /下载/ })` 为 null）；
2. 主按钮点击调用 `onToggleFile(file)` 一次（不自持状态，`open` 由调用方翻转发回）；
3. 点 `▾` 展开菜单：菜单内「下载」为 `<a>`，`href === recordingFileUrl(roomId, file.name)`（文件名含中文/空格时经 `encodeURIComponent`，对齐 `flv-player-panel.test.tsx:257-264` 夹具）、带 `download` 属性；开关 `aria-expanded="true"`；
4. 再点 `▾` / 点击容器外（`fireEvent.mouseDown(document.body)`）/ 按 Esc（`fireEvent.keyDown(document, { key: "Escape" })`）三种路径菜单均关闭；
5. 点击菜单内「下载」后菜单关闭（下载本身为原生 `<a download>` 行为，jsdom 不触发真实下载，仅断言菜单关闭与链接属性）；
6. `open` 由 true 翻回 false（模拟播放器被关闭/他文件接管）后按钮文案复位为「播放」——复位逻辑零组件内代码，该用例锁定「纯受控」契约。

实现侧同时给出组件签名空壳使测试可运行（红在断言而非挂载失败）：`apps/bookstore/features/recordings/RecordingFileActions.tsx` 导出默认组件，props 类型 `{ roomId: number; file: RecordingFile; open: boolean; onToggleFile: (file: RecordingFile) => void }`。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recording-file-actions.test.tsx` 按预期红（行为断言失败）。

### 步骤 2：RecordingFileActions 实现 + RoomRecordingsGroup 接入（绿）

实现（绿）：

1. `features/recordings/RecordingFileActions.tsx`：
   - 容器 `div.relative` + `containerRef`，`useDismiss(containerRef, menuOpen, () => setMenuOpen(false))`（import 自 `@/features/schedule/useDismiss`）；
   - 主按钮与开关置于同一 `rounded-full border border-vine` 容器内分段（中间 `border-l border-vine` 分隔），文案/类名沿用文件行 `text-tiny text-ink-dim hover:text-flower` 语义色，焦点环 `focus-visible:outline-flower`；主按钮图标 `Play`（lucide，`aria-hidden`）+ 文案，开关用 `ChevronDown`；
   - 菜单 `absolute right-0 z-[80] mt-1 rounded-md border border-vine/50 bg-raised shadow-xl`（对齐 `MarkReadButtonGroup.tsx:96`），`role="menu"`；内含唯一「下载」`<a role="menuitem" href={recordingFileUrl(roomId, file.name)} download onClick={() => setMenuOpen(false)}>`；
   - 播放状态零自持：主按钮 `onClick={() => onToggleFile(file)}`，文案与 `aria-expanded` 完全由 `open` prop 派生；
2. `features/recordings/RoomRecordingsGroup.tsx`：删除 `:122-128` 裸下载 `<a>`，原位渲染 `<RecordingFileActions roomId={roomId} file={file} open={open} onToggleFile={onToggleFile} />`（`open` 复用 `:104` 既有计算）；文件名按钮、大小/时间、`FlvPlayerPanel` 挂载点均不动。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recording-file-actions.test.tsx` 全绿；`pnpm -C apps/bookstore lint` 通过。

### 步骤 3：既有用例最小更新（接口变更的正常测试更新）

1. `flv-player-panel.test.tsx:257-264`「文件项『下载』链接与播放同源且文件名经编码」：`renderAndExpand` 后改为先 `fireEvent.click(screen.getAllByRole("button", { name: "更多操作" })[0])` 展开菜单，再取菜单内链接断言 href/download（断言目标值不变）；`:222-235` isSupported 降级用例（`within(panel)` 断言 `FlvPlayerPanel` 内部下载按钮）不动；
2. `recordings-groups.test.tsx` 六用例不断言下载链接，预期零改动全绿——若有因行内结构变化引发的间接失败，按「行为不变仅结构变」原则最小修复，不改用例语义；
3. 新增整机用例（并入 `recordings-groups.test.tsx` 或步骤 1 新文件，取简单者）：展开分组 → 点「播放」→ `FlvPlayerPanel` 出现且主按钮变「收起」；点「收起」播放器折叠按钮复位——锁定按钮组与既有单例通路的接线（mpegts.js mock 沿用既有设施）。

**验证**：`pnpm -C apps/bookstore test` 全绿（新用例 + 既有用例零回归）。

### 步骤 4：e2e 更新与运行

加载 SKILL: z-test。更新 `tests/e2e/src/bookstore/recordings.spec.ts`：

1. `:115-124`「recordings-download」：展开分组后先断言文件行**无**直接「下载」链接（`getByRole("link", { name: "下载" })` count 为 0），再点首个 `▾` 开关（`getByRole("button", { name: "更多操作" }).first()`），取菜单内「下载」链接断言 `href` 含 `/api/b/live/1/recordings/` 与编码文件名、`download` 属性（断言值不变）；
2. 新增「recordings-play-actions」用例：展开分组 → 点主按钮「播放」→ `page.getByRole("region", { name: "录播播放区" })` 可见且按钮变「收起」（对齐 `:126-139` preview 用例的桩断言口径，真实媒体播放不断言）；点「收起」播放区消失、按钮复位；
3. 运行方式遵循 `tests/e2e/AGENTS.md`：Aspire 拉起后经 `aspire describe` 注入 `BOOKSTORE_BASE_URL`/`API_BASE_URL`，录播上游继续 `page.route` mock（`NEXT_PUBLIC_RECORDINGS_BASE_URL` 非空由 apphost 注入，现状不变）。

**验证**：`cd tests/e2e && pnpm playwright test src/bookstore/recordings.spec.ts` 通过；既有 spec 不回归。

### 步骤 5：spec 同步与收尾验收

1. `docs/product/spec/site-pages.md:61` F5 节：「每个文件项提供『下载』`<a href download>`」改写为按钮组现态——文件项右侧为「播放/收起 + `▾` 下拉」按钮组，「下载」入口收于下拉菜单（`<a href download>`，URL 与行为不变），菜单支持点击外部/Esc 关闭；
2. `docs/engineering/spec/frontend-bookstore.md:63` 组件清单：`RoomRecordingsGroup` 描述补「文件行操作区为 `RecordingFileActions` 按钮组」，枚举追加 `RecordingFileActions`（split button 受控组件：主按钮复用 `onToggleFile` 通路、菜单 `useDismiss` 收起、菜单内 `<a download>` 原生下载）；
3. `apps/bookstore/AGENTS.md:84` 录播页约定组件枚举同步补 `RecordingFileActions`；根 `AGENTS.md` 无变更（无结构与契约变更）；
4. 核对 PRD §1.3 成功标准、§3.2 F1 验收标准与提案 §10 全量通过；
5. 推送 `feat/recordings-play-actions`，提 PR 回合 `prd/recordings-play-actions`（需求总 PR #136 随之更新）。

**验证**：`pnpm lint && pnpm test`（workspace 级）+ `pnpm -C apps/bookstore build` 全绿；e2e 录播 spec 通过；PRD/提案验收清单逐项勾选。

## 4. 依赖与风险

- **依赖**：既有 `onToggleFile`/`openFile` 单例机制（`RecordingsApp`，不变更）；`useDismiss` hook 与 `lucide-react`（既有，零新增依赖）；上游录播端点行为不变；
- **风险**：菜单在文件行内绝对定位可能被父级裁剪或遮挡末行——菜单 `z-[80]` 对齐 `MarkReadButtonGroup` 先例，步骤 2 实现后目视检查桌面/移动端与每页末行文件的菜单展示（PRD §3.3）；
- **风险**：「菜单展开中翻页/折叠分组」的浮层残留——由文件行卸载天然销毁 `menuOpen`，步骤 1 单测以「组件卸载」路径覆盖（卸载后无残留监听，`useDismiss` 的 effect cleanup 已保证）；
- **约束**：并行需求 `feat/recordings-seek-fullscreen`（PR #135）在途——变更面无文件级重叠（其改 `FlvPlayerPanel`/`player.ts`，本期改 `RoomRecordingsGroup`/新增 `RecordingFileActions`/两侧测试），合入顺序先后均可，若有文件级冲突以后合入者为准做 merge；
- **范围纪律**：不改 `servers/api`/契约/编排资源；不动 `FlvPlayerPanel` 内部 MSE 降级下载按钮；不新增依赖（PRD §五、提案 §1.3）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-15-recordings-play-actions-prd.md]]
- 技术提案：[[../proposals/2026-09-15-recordings-play-actions-proposal.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 前端规范：[[../frontend-rules.md]]
- 页面设计：`../../design/02-page-design.md`
