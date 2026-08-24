---
description: 周表图片自定义实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。唯一开发分支 feat/weekly-image-customization，纯前端改动集中在 apps/bookstore/features/schedule/weeklyImage/：新增 scheme.ts（方案模型/Zod/解析/变量求值）与 storage.ts（localStorage 读写+内存兜底），扩展 layout.ts（接受 scheme 产出 align/color/textWidth）与 renderer.ts（按对齐/字号/颜色绘制），改造 WeeklyImageDialog.tsx（设置面板+方案标识+按天编辑+自动新建周方案）；全部单测 TDD 落地；契约/服务端/编排零变更。
type: Permanent
---

# 周表图片自定义 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-24-weekly-image-customization-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-24-weekly-image-customization-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/weekly-image-customization`
**开发分支**: `feat/weekly-image-customization`（自需求总分支切出，**唯一开发分支**，全部前端实现与测试同在此分支，纯前端，无服务端/契约/编排变更）
**版本**: v1.0（2026-08-24）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态）：

- `apps/bookstore/features/schedule/weeklyImage/layout.ts`：常量 `ROW_X=365`（`:15`）、`ROW_Y=[278,379,480,580,681,782,883]`（`:16`）、`ROW_WIDTH=715`（`:17`）、`ROW_HEIGHT=70`（`:18`）、`BASE_FONT_SIZE=40`（`:19`）、`MIN_FONT_SIZE=22`（`:20`）；`fitToWidth`（`:34-47`）自 `BASE_FONT_SIZE` shrink-to-fit 到 `MIN_FONT_SIZE`、触底仍超宽则截断加「…」；`DrawInstruction` 接口（`:3-12`）字段 `dayIndex/x/y/width/height/text/fontSize`；`layoutWeek(plans, monday, measure)`（`:53-78`）按 `startTime` 升序以 `" / "` 连接为单行（`:66`）、`x` 恒为 `ROW_X`（`:70`，即恒左对齐）；
- `apps/bookstore/features/schedule/weeklyImage/renderer.ts`：`TEXT_COLOR="#342a40"`（`:7`）、`FONT_STACK`（`:8`）、`FONT_SPEC="600 40px …"`（`:9`）；`renderWeekImage`（`:34-68`）2× 离屏超采样 + `imageSmoothingQuality:"high"` 缩回 1665×1080，绘制循环 `:51-55` `fillStyle=TEXT_COLOR`（`:49`）、`fillText(ins.text, ins.x, centerY)`（`:54`）——恒深色、恒字号、恒左对齐；
- `apps/bookstore/features/schedule/weeklyImage/WeeklyImageDialog.tsx`：`canvasMeasure`（`:14-27`，懒创建可注入的文本测量）；`layoutWeek(plans, monday, canvasMeasure())` 调用在 `:69`；重绘 `useEffect` 依赖 `[open, week, plans, retryNonce, renderImage, baseImageUrl]`（`:85`）；无任何设置项与持久化；
- `apps/bookstore/features/schedule/weeklyImage/weekUtils.ts`：`getISOWeek`/`getWeekRange`/`shiftWeek`/`formatWeekLabel`（ISO-8601 周，周一为首日），供方案按 ISO 周归属复用；
- 既有测试基底：`apps/bookstore/tests/unit/schedule-weekly-image-dialog.test.tsx`（`renderImage` 打桩驱动重绘，已有渲染命中 `img` 断言）；`apps/bookstore/tests/unit/home-weekly-guard.test.tsx`（周表守卫，不涉本功能）；
- 素材坐标：`public/assets/original/AGENTS.md`（`weekly-schedules-raw.jpg` 1665×1080，每日区域 715×70，左上角 x=365，y=278…883）；底图同源分发（跨域会污染画布导致 `toDataURL` 抛错）。
- 依赖补充：`apps/bookstore/package.json` **无 lodash**——`cloneDeep` 用 JS 内建 `structuredClone`（现代浏览器/Node 17+）或手写不可变更新；Zod 版本 `^4.4.3`。

整体顺序（**串行**，唯一开发分支 `feat/weekly-image-customization`，依赖链明确：模型 → 存储 → layout → renderer → 弹层接线）：
**切开发分支 → scheme.ts 方案模型/解析/变量求值（TDD）→ storage.ts localStorage 读写（TDD）→ layout.ts 依方案产出指令（TDD）→ renderer.ts 按对齐/字号/颜色绘制（TDD）→ WeeklyImageDialog.tsx 设置面板/方案标识/按天编辑/自动新建（TDD）→ spec 同步 + e2e 适配 + 收尾验收**。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 对齐方式 | 恒左对齐（`layout.ts:70` `x=ROW_X`、`renderer.ts:54` 直绘） | 全局/按天可选 左/中/右；`renderer` 按 `align`+`textWidth` 计算绘点并 `clamp` 防越界 |
| 字号 | 固定 `BASE_FONT_SIZE=40` 起 shrink | 用户设定字号（16–60px，默认 40）作 shrink 基准，触底 `MIN_FONT_SIZE=22` 截断保持不变 |
| 颜色 | 固定 `TEXT_COLOR="#342a40"` | 用户设定颜色（默认应援色 `#b4a6bf`），`renderer` `fillStyle` 用之 |
| 全局/按天 | 无 | 全局设置（对齐/字号/颜色）为 7 日默认；单日三项可部分覆盖（留空=沿用全局） |
| 按天内容 | 计划自动拼接（`layout.ts:66`） | 每日编辑框 + 插入 `{schedules}` 变量；`resolveDayText` 替换为自动拼接文案；空文案该日不绘制 |
| 方案留存 | 无概念，周表图仅预览 | 默认方案 + 按周方案，localStorage 持久化；无周方案回退默认，任一编辑自动新建本周方案；切周按各周方案渲染 |

契约（`contract/*`）、服务端（`servers/api`）、编排（`infra/aspire`）零变更。

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/weekly-image-customization`；
- 开发工作（前端实现 + 单元测试）全部在**唯一开发分支** `feat/weekly-image-customization` 上进行（自 `prd/weekly-image-customization` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 1：方案模型与变量求值（scheme.ts，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。新增 `apps/bookstore/features/schedule/weeklyImage/scheme.ts`：

1. **类型与 Zod**（对应提案 §4.1）：
   ```ts
   export type TextAlign = "left" | "center" | "right";
   export interface DaySettings { content: string; align?: TextAlign; fontSize?: number; color?: string; }
   export interface DefaultScheme { version: 1; global: { align: TextAlign; fontSize: number; color: string }; days: DaySettings[]; }
   export interface WeekScheme extends DefaultScheme { week: { year: number; week: number }; }
   ```
   Zod schema：`TextAlignSchema = z.enum(["left","center","right"])`；`color` 用 `z.string()`（长度/格式白名单 ≤ 20 字符即可，取值约束见渲染）；`days` 数组 `z.array(...).length(7)`。
2. **`createDefaultScheme()`**：`global = { align:"left", fontSize:40, color:"#b4a6bf" }`，`days[i] = { content:"{schedules}" }`。
3. **`resolveEffectiveScheme(week, store)`**：`store.getWeek(week) ?? store.getDefault()`（store 见步骤 2）。
4. **`buildDaySchedulesText(plans)`**：抽出现态 `layout.ts:66` 的拼接逻辑为纯函数——同日多场按 `startTime` 升序以 `" / "` 连接成 `HH:mm 标题`；空数组返回 `""`。
5. **`resolveDayText(template, schedules)`**：`{schedules}` 用 `split`/`join` 替换（非正则防特殊字符）；模板无 `{schedules}` 原样返回；`schedules=""` 时替换为空串。
6. **`ensureWeekScheme(base, week)`**：以 `base` 为基底用 `structuredClone` 复制并附 `week` 归属（供自动新建周方案用）。

**测试先行** 新增 `apps/bookstore/tests/unit/weekly-image-scheme.test.ts`：
- `createDefaultScheme`：左对齐、40px、`#b4a6bf`、每日 `{schedules}`；`days.length===7`；
- `resolveEffectiveScheme`：有周方案优先、无则默认、Zod 非法输入回退内置默认（`safeParse` 失败路径）；
- `resolveDayText`：`{schedules}` 替换、无变量原样、空计划空串、`schedules` 为空串时替换为空串、多 `{schedules}`/边界；
- `buildDaySchedulesText`：同日多场升序 ` / ` 拼接、空数组 `""`；
- `ensureWeekScheme`：深拷贝基底、附 `week`、不改 `base` 原对象。

**验证**：`pnpm -C apps/bookstore test -- weekly-image-scheme` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 2：localStorage 读写（storage.ts，TDD）

新增 `apps/bookstore/features/schedule/weeklyImage/storage.ts`（对应提案 §4.3、§5.2 实现点 2）：

1. **key 规约**：`weekly-image.default` → 默认方案；`weekly-image.week.{year}-{week}`（如 `weekly-image.week.2026-33`）；导出 `weekKey(year, week)` 供复用。
2. **接口**：`loadDefault()` / `saveDefault(scheme)` / `loadWeek(week)` / `saveWeek(scheme)` / `deleteWeek(week)` / `hasWeek(week)`。
3. **读取一律 Zod `safeParse`**：失败回退 `createDefaultScheme()`；`localStorage` 不存在/抛错（隐私模式）用模块级内存 `Map<string, DefaultScheme|WeekScheme>` 兜底（仅本次会话有效，可生成但不持久），读写接口内部屏蔽差异。
4. **加载顶层缓存**：模块级在首次访问时解析 default 与各 week，供 `resolveEffectiveScheme` 同步读取。

**测试先行** 新增 `apps/bookstore/tests/unit/weekly-image-storage.test.ts`（jsdom，`beforeEach` 清 `localStorage`）：
- `saveDefault`/`loadDefault` 往返一致；`saveWeek`/`loadWeek` 往返一致（含 `week` 归属）；
- 损坏 JSON / Zod 非法（如 `global.align="up"`）→ `loadDefault`/`loadWeek` 回退内置默认；
- `deleteWeek` 后 `hasWeek` 为 false、`loadWeek` 回退默认；
- `localStorage` 不可用（`vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw ...})`）→ 走内存 Map，回退默认、跨实例读写走内存兜底。

**验证**：`pnpm -C apps/bookstore test -- weekly-image-storage` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 3：layout 依方案产出指令（layout.ts，TDD）

扩展 `apps/bookstore/features/schedule/weeklyImage/layout.ts`（对应提案 §5.2 实现点 3；保持向后兼容）：

1. **`DrawInstruction` 扩展**：新增 `align: TextAlign`、`color: string`、`textWidth: number`。
2. **`layoutWeek(plans, monday, measure, scheme = createDefaultScheme())`**：`scheme` 缺省回退默认，避免破坏现有调用与既有单测。对每天：
   - 取 `dayPlan = scheme.days[dayIndex]`，计算 `schedules = buildDaySchedulesText(dayPlans)`、`有效内容 = resolveDayText(dayPlan.content, schedules)`；内容为空串则该日**不产出指令**；
   - `有效字号 = dayPlan.fontSize ?? scheme.global.fontSize`（默认 40），`fitToWidth` 自该字号 shrink 到 `MIN_FONT_SIZE`（22）防溢出、超宽截断；
   - `textWidth = measure(fitted, fontSize)`；`align = dayPlan.align ?? scheme.global.align`；`color = dayPlan.color ?? scheme.global.color`；
   - 产出 `DrawInstruction`（`x` 仍记录区域左边界 `ROW_X`，实际绘点由 renderer 按 `align`/`textWidth` 计算）。
3. `ROW_X`/`ROW_WIDTH`/`ROW_Y`/`ROW_HEIGHT`/`BASE_FONT_SIZE`/`MIN_FONT_SIZE` 常量保持不变；`buildDaySchedulesText` 迁移到 `scheme.ts` 后此处 import 复用（避免重复逻辑）。

**测试先行** 更新 `apps/bookstore/tests/unit/weekly-image-layout.test.ts`（若尚无，则新建）：
- 全局对齐 左/中/右 → 输出 `align` 正确（`x` 恒 `ROW_X`）；
- 单日覆盖优先：`days[i].align` 覆盖全局；部分覆盖（仅颜色）→ 其余沿用全局；
- 内容为空串 → 该日不产出指令；
- 文案含 `{schedules}` 求值正确；自定义文案（`今日直播：{schedules}`）求值正确；
- 大字超出区域 → shrink/截断仍生效（`textWidth` 实测、`fontSize >= 22`）；
- `scheme` 缺省 → 回退默认（`align="left"`、`color="#b4a6bf"`、`fontSize=40`）；指令含 `align`/`color`/`textWidth` 字段。

**验证**：`pnpm -C apps/bookstore test -- weekly-image-layout` 全绿；`pnpm -C apps/bookstore test -- schedule-weekly-image-dialog`（既有 `layoutWeek` 调用经缺省回退不回归）绿。

### 步骤 4：renderer 按对齐/字号/颜色绘制（renderer.ts，TDD）

改 `apps/bookstore/features/schedule/weeklyImage/renderer.ts`（对应提案 §5.2 实现点 4）：

1. **抽出纯函数 `computeTextX(align, x, width, textWidth)`**（jsdom 无 Canvas，独立可测）：`left → x`；`center → x + (width - textWidth)/2`；`right → x + width - textWidth`；并 `clamp` 到 `[x, x + width - textWidth]` 防越界（极端超宽兜底）。
2. **`renderWeekImage` 绘制循环**：每条指令 `offCtx.font = 600 {ins.fontSize}px {FONT_STACK}`、`offCtx.fillStyle = ins.color`、`const x = computeTextX(ins.align, ins.x, ins.width, ins.textWidth)`、`fillText(ins.text, x, centerY)`。仍 2× 超采样 + `imageSmoothingQuality:"high"` 缩回 1665×1080；`TEXT_COLOR` 常量保留为 fallback（指令缺省 `color` 时兜底，避免破坏无 scheme 调用）。
3. **`FONT_SPEC`/`TEXT_COLOR` 保持导出**（既有测试/引用不破坏）；`renderWeekImage` 签名不变。

**测试先行** 新增 `apps/bookstore/tests/unit/weekly-image-renderer.test.ts`：
- `computeTextX`：left/center/right 三态计算正确；textWidth 大于 width 时 clamp 不越界（结果 ∈ `[x, x+width-textWidth]`）；
- （Canvas 绘制路径 jsdom 不打桩，仅在 `WeeklyImageDialog` 组件测试中以 `renderImage` 桩确认签名兼容与新字段传递「见步骤 5」）。

**验证**：`pnpm -C apps/bookstore test -- weekly-image-renderer` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 5：弹层 UI 与状态编排（WeeklyImageDialog.tsx，TDD）

改 `apps/bookstore/features/schedule/weeklyImage/WeeklyImageDialog.tsx`（对应提案 §5.2 实现点 5）；加载 `docs/design/03-backdoor-design.md`（仅 `@theme` token、后台控件过渡 ≤200ms、尊重 `prefers-reduced-motion`）：

1. **状态**：`scheme`（`useState<DefaultScheme>`，初始 `resolveEffectiveScheme(当前周)`）、`editingDefault`（`useState<boolean>`，是否编辑默认方案）、`week`（既有）；`plans` 沿用。
2. **有效方案**：`effective = resolveEffectiveScheme(week)`；方案标识 `<div>` 显示「默认方案」/「{year} 年第 {week} 周方案」徽标 + 「编辑默认方案」切换按钮（`editingDefault` 显式高亮）。
3. **全局设置**：对齐三选（左/中/右 segmented 控件）、字号（输入 + 增减，16–60）、颜色（色板 + 输入，默认 `#b4a6bf`）。
4. **按天设置**：七日折叠面板（label 周一~周日），每项：内容编辑框 + 「插入 {schedules}」按钮（光标处插入）+ 覆盖对齐/字号/颜色三项（留空 = 沿用全局）。
5. **自动新建**：任一变更 handler（全局或某日）在 `editingDefault === false` 时先 `ensureWeekScheme`（首次以当前有效方案为基底 `structuredClone` 复制为本周 `WeekScheme`），写 `storage.saveWeek`，更新 state；`editingDefault === true` 时写 `storage.saveDefault` 且不触发建周。
6. **重绘**：`useEffect` 依赖加入 `scheme`（对象引用），按 `layoutWeek(plans, monday, canvasMeasure(), effective)` + `renderImage` 重绘；切周时 `scheme` 重置为对应周有效方案。
7. **不可变更新**：`global`/`days[i]` 采用 struct-sharing 更新（更新整层对象），保证 `scheme` 引用变化触发重绘；字号/文案高频输入可加轻量防抖（300ms）防抖动（可选）。

**测试先行** 更新 `apps/bookstore/tests/unit/schedule-weekly-image-dialog.test.tsx`：
- 弹层打开渲染「默认方案」徽标与设置面板（对齐三选、字号、颜色）；
- 改动全局对齐 → `saveWeek` 被调用（`editingDefault=false` 时自动建本周方案）、`saveDefault` 未被调用、`renderImage` 重跑（断言其新指令 `align`）；
- 「编辑默认方案」模式改动 → `saveDefault` 被调用、不建周方案；
- 切周：各周按各自有效方案渲染（`week` 变化时 `scheme` 重置）；无周方案周显示「默认方案」；
- 某日文案编辑 + 插入 `{schedules}` → 指令文本含求值结果；
- 既有用例（周标签、预览 img、关闭、错误重试）保持绿；`renderImage` 桩适配新签名（含 `align`/`color`/`textWidth`）。
- storage 层以注入/真实 `localStorage` 穿插，`afterEach` 清 `localStorage`。

**验证**：`pnpm -C apps/bookstore test -- schedule-weekly-image-dialog` 全绿；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿。

### 步骤 6：e2e 适配与收尾验收

1. **e2e 适配**（SKILL: z-test，`tests/e2e/`）：既有公开展示/后台直播计划 e2e 不涉本次 `weeklyImage` 弹层设置 → 默认回退（无周方案用默认）保证既有断言零回归；如需可补一条极小的 Playwright「打开生成周表图片弹层 → 切换对齐 → 预览更新」用例（后台弹层交互，以单测为主，e2e 仅回归守卫）；
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内、按开发分支落地时同步）：更新 `docs/product/spec/schedule-admin.md`（周表图片弹层现态：对齐/字号/颜色全局与按天设置、`{schedules}` 变量、默认方案 + 按周方案 localStorage 留存与回退）、`docs/engineering/spec/frontend-bookstore.md`（`scheme.ts`/`storage.ts`/`layout.ts`/`renderer.ts`/`WeeklyImageDialog.tsx` 现态与功能口径）；PRD 与提案为时点文档，不改原文；
3. 检查 `apps/bookstore/AGENTS.md`「周表 / 直播计划约定」段落是否需同步新口径；
4. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（对齐切换、字号/颜色默认 `#b4a6bf`、全局/按天区分与部分覆盖、按天编辑 + `{schedules}` 求值、按周方案回退与自动新建、刷新回显、非法回退、`pnpm lint && pnpm test && pnpm build` 全绿）；
5. 推送 `feat/weekly-image-customization` 并提 PR 至 `prd/weekly-image-customization`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：既有 `features/schedule/weeklyImage/` 全部实现（`layout`/`renderer`/`WeeklyImageDialog`/`weekUtils`）、`features/schedule/api.ts` 的 `listPlans`、Zod v4、`apps/bookstore` 后端设计 token 规范；**无 lodash**——深拷贝用 `structuredClone`；
- **并行协调**：唯一开发分支 `feat/weekly-image-customization`；依赖链明确（scheme → storage → layout → renderer → 弹层），subagent 串行；契约/服务端/编排零变更，无可并行后端任务；
- **风险**（对应提案 §5.2 与 §6.1）：
  - **对齐越界**：`computeTextX` 对 `textWidth > width` 的极端情况 `clamp`，`fitToWidth` 已 shrink + 截断兜底（`MIN_FONT_SIZE=22`）；
  - **localStorage 损坏/不可用**：Zod `safeParse` 回退内置默认；隐私模式降级内存 Map（仅会话有效、可生成不持久，对应 PRD §4.3/§5.3）；
  - **自动新建周方案时序**：编辑先 `ensureWeekScheme`（以当前有效方案为基底复制）再写变更，避免默认方案被「周编辑」污染；`editingDefault` 模式隔离，不建周方案；
  - **重绘频率**：击键重绘单次 Canvas + 底图浏览器缓存可接受；如抖动明显在字号/文案输入加 300ms 防抖；`scheme` 引用变化驱动重绘；
  - **既有测试回归**：`layoutWeek` 缺省 `scheme` 回退默认保持既有单测绿；`renderImage` 桩适配新签名。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-24-weekly-image-customization-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-24-weekly-image-customization-proposal.md]]（v1.0）
- 前端规范：[[../frontend-rules.md]]、后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/schedule-admin.md`
- 素材坐标：`public/assets/original/AGENTS.md`
- 参照实现方案：[[2026-08-23-danmaku-hover-bar-impl-plan.md]]（接线/收尾口径）
