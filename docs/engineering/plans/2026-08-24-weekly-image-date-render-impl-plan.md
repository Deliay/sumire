---
description: 周表图片日期渲染实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。唯一开发分支 feat/weekly-image-date-render，纯前端改动集中在 apps/bookstore/features/schedule/weeklyImage/：扩展 scheme.ts（新增 DateSchemeConfig 类型/Zod/默认与解析、formatDate/buildDateContent 纯函数、resolveDateConfig 回退），扩展 layout.ts（DATE_* 常量 + 额外产出 dayIndex=-1 的日期 DrawInstruction），renderer.ts 零改动，WeeklyImageDialog.tsx 新增「日期设置」区块并纳入默认+按周方案持久化；全部单测 TDD 落地；契约/服务端/编排零变更。
type: Permanent
---

# 周表图片日期渲染 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-24-weekly-image-date-render-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-24-weekly-image-date-render-proposal.md]]（v1.0）
**关联设计**: [[../../design/03-backdoor-design.md]]
**需求总分支**: `prd/weekly-image-date-render`
**开发分支**: `feat/weekly-image-date-render`（自需求总分支切出，**唯一开发分支**，全部前端实现与测试同在此分支，纯前端，无服务端/契约/编排变更）
**版本**: v1.0（2026-08-24）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。**前提事实**（已在需求总分支核对代码现态，均在上一迭代 `weekly-image-customization` 已上线实现之上）：

- `apps/bookstore/features/schedule/weeklyImage/scheme.ts`：`TextAlignSchema`（`:5`）；`DaySettingsSchema`（`:8-14`，`align?`/`fontSize?`(16-60)/`color?`(≤20)）；`DefaultSchemeSchema`（`:16-24`，`version/global/days[7]`）；`createDefaultScheme()`（`:35-41`，`global={align:"left",fontSize:40,color:"#5b4b68"}`）；`resolveEffectiveScheme(week, store)`（`:43-56`）；`buildDaySchedulesText`（`:58`）与 `resolveDayText`（`:63`，`{schedules}` split/join）；`ensureWeekScheme(base, week)`（`:67-73`，`structuredClone` + 附 `week`）；
- `apps/bookstore/features/schedule/weeklyImage/layout.ts`：`DrawInstruction`（`:5-17`，含 `dayIndex/x/y/width/height/text/fontSize/align/color/textWidth`）；`ROW_X=365`（`:20`）、`ROW_Y=[…]`（`:21`）、`ROW_WIDTH=715`（`:22`）、`ROW_HEIGHT=70`（`:23`）、`BASE_FONT_SIZE=40`（`:24`）、`MIN_FONT_SIZE=22`（`:25`）；`daysBetween`（`:30-36`）；`fitToWidth(text,width,measure,baseFontSize=BASE_FONT_SIZE)`（`:39-52`，自基准 shrink 到 `MIN_FONT_SIZE` 截断）；`layoutWeek(plans, monday, measure, scheme=createDefaultScheme())`（`:58-102`）；
- `apps/bookstore/features/schedule/weeklyImage/renderer.ts`：`computeTextX`（`:18-34`，left/center/right + clamp 防越界）；`renderWeekImage`（`:63-100`，2× 离屏超采样 + `imageSmoothingQuality:"high"` 缩回 1665×1080；绘制循环 `:80-86` 已按 `ins.fontSize/fillStyle/computeTextX/fillText` **通用地**绘制任意指令，日期指令可直接复用，**无需改动**）；
- `apps/bookstore/features/schedule/weeklyImage/WeeklyImageDialog.tsx`：`canvasMeasure`（`:25-38`）；`scheme` state（`:61`）；重绘 `useEffect`（`:96-116`，依赖含 `scheme`，日期变更自动触发重绘）；`handleGlobalChange`（`:140-158`，`editingDefault` 分支：写 `saveDefault` 或 `ensureWeekScheme`+`saveWeek`）；`handleDayChange`（`:161-181`）；
- `apps/bookstore/features/schedule/weeklyImage/storage.ts`：既有 `loadDefault/saveDefault/loadWeek/saveWeek/deleteWeek/hasWeek`（localStorage + 内存兜底 + Zod `safeParse` 回退），key `weekly-image.default` / `weekly-image.week.{year}-{week}`；
- **日期绘制区域坐标**：`(640,80)`，可用 `451×40`。该坐标在 `feat/weekly-image-date-area` 分支的 `apps/bookstore/public/assets/original/AGENTS.md` 已确认（「日期绘制区域：左上角 640,80，可用大小 451*40」），但**当前需求总分支的 `public/assets/original/AGENTS.md` 尚未含此行**——开发分支需把该行补入 `public/assets/original/AGENTS.md`（对应提案 §1.1，坐标以涉事分支为准）。
- 既有测试基底：`apps/bookstore/tests/unit/weekly-image-scheme.test.ts`、`weekly-image-layout.test.ts`、`weekly-image-storage.test.ts`、`weekly-image-renderer.test.ts`、`schedule-weekly-image-dialog.test.tsx`（`renderImage` 打桩驱动重绘）；
- 依赖：`apps/bookstore/package.json` **无日期库**，日期格式化/周计算沿用 `dateUtils.ts` 的 `toDateStr`（`:69`）/自实现风格；无 lodash，深拷贝用 `structuredClone`；Zod `^4.4.3`。

整体顺序（**串行**，唯一开发分支 `feat/weekly-image-date-render`，依赖链明确：scheme 纯函数 → layout 日期指令 → 弹层接线）：
**切开发分支 → 资源 AGENTS.md 补日期区域 → scheme.ts 日期配置/格式化/解析回退（TDD）→ layout.ts 日期指令（TDD）→ WeeklyImageDialog.tsx「日期设置」区块与持久化（TDD）→ spec 同步 + e2e 回归 + 收尾验收**（renderer 零改动，不设独立步骤）。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 日期渲染 | 无；底图顶部日期区域闲置 | 在日期区域 `(640,80)/451×40` 渲染该周「开始日期 ~ 结束日期」（周一~周日） |
| 日期格式 | 无 | 模板变量 `{yyyy}/{yy}/{mm}/{m}/{dd}/{d}`，默认 `{yyyy}年{mm}月{dd}日` |
| 日期内容 | 无 | 模板变量 `{开始日期}/{结束日期}`，默认 `{开始日期} ~ {结束日期}`；空串不绘制 |
| 日期样式 | 无 | 独立字号（默认 **20px**）、对齐、颜色（默认沿用全局 `#5b4b68`），可独立覆盖 |
| 日期持久化 | 无 | 作为 `DefaultScheme.date`（可选）随「默认 + 按周」方案持久化，旧数据回退内置默认 |

契约（`contract/*`）、服务端（`servers/api`）、编排（`infra/aspire`）零变更；`renderer.ts` 零改动。

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/weekly-image-date-render`；
- 开发工作（前端实现 + 单元测试）全部在**唯一开发分支** `feat/weekly-image-date-render` 上进行（自 `prd/weekly-image-date-render` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：资源 AGENTS.md 补日期区域坐标

在 `apps/bookstore/public/assets/original/AGENTS.md` 的周表小节中补充（自 `feat/weekly-image-date-area` 分支引入，属本期功能的前置坐标事实）：

```
日期绘制区域：左上角「640,80」，可用大小是「451*40」。
```

**验证**：`git diff` 仅新增该行；坐标与提案 §1.1 / PRD §5.2 一致。

### 步骤 1：日期配置模型与纯函数（scheme.ts，TDD）

加载 `apps/bookstore/AGENTS.md`、`docs/engineering/frontend-rules.md`。扩展 `apps/bookstore/features/schedule/weeklyImage/scheme.ts`（对应提案 §4.1、§5.2 实现点 1/2）：

1. **`DateSchemeConfig` 类型与 Zod**（可选，缺省回退内置默认）：
   ```ts
   export interface DateSchemeConfig {
     format: string;            // 日期格式模板，默认 "{yyyy}年{mm}月{dd}日"
     content: string;           // 日期内容模板，默认 "{开始日期} ~ {结束日期}"
     align?: TextAlign;         // 空=沿用全局
     fontSize?: number;         // 空=沿用内置更小默认 DATECONFIG_DEFAULT_FONT_SIZE=20
     color?: string;            // 空=沿用全局默认色
   }
   export const DateSchemeConfigSchema = z.object({
     format: z.string(),
     content: z.string(),
     align: TextAlignSchema.optional(),
     fontSize: z.number().min(14).max(DATECONFIG_MAX_FONT_SIZE).optional(), // 上限 30，下限 14（日期区域更小）
     color: z.string().max(20).optional(),
   });
   ```
2. **`DefaultSchemeSchema` 增加可选 `date`**：`date: DateSchemeConfigSchema.optional()`（旧数据无 `date` 时 `safeParse` 仍成功，向后兼容）；`WeekSchemeSchema` 继承之同样可选。
3. **`createDefaultDateConfig()`**：返回 `{ format:"{yyyy}年{mm}月{dd}日", content:"{开始日期} ~ {结束日期}", align:undefined, fontSize:undefined, color:undefined }`（字号/对齐/颜色用空值表示「沿用/走内置默认」）。
4. **`formatDate(dateStr: string, format: string): string`**：入参 `YYYY-MM-DD`，逐变量 `split`/`join` 替换（单趟，变量互不同名不干扰；非正则防特殊字符）：
   - `{yyyy}`→四位年；`{yy}`→两位年（`String(year).padStart(2,"0").slice(-2)`，如 2026→26）；`{mm}`/`{dd}`→补零两位（如 08/31）；`{m}`/`{d}`→一位或多位（如 8/9）。日期解析用 `split("-").map(Number)`（复用 `layout.ts` `daysBetween` 思路，不引入日期库）。
5. **`buildDateContent(template, startStr, endStr): string`**：将 `{开始日期}`/`{结束日期}` 分别替换为已格式化的开始/结束串；模板为空串返回空串。
6. **`resolveDateConfig(scheme: DefaultScheme)`**：返回 `{ format, content, align: date.align ?? scheme.global.align, fontSize: date.fontSize ?? DATECONFIG_DEFAULT_FONT_SIZE, color: date.color ?? scheme.global.color }`；`scheme.date` 缺失/非法时 `format/content` 取内置默认；字号有缺失回落到更小默认 `20`。

**测试先行** 扩展 `apps/bookstore/tests/unit/weekly-image-scheme.test.ts`：
- `formatDate`：`{yyyy}`/`{yy}`/`{mm}`/`{m}`/`{dd}`/`{d}` 各变量替换正确；补零（`08`）与非补零（`8`）边界；2026-08-31 对应默认模板输出 `2026年08月31日`；非变量文字原样保留；变量位于任意位置。
- `buildDateContent`：`{开始日期}`/`{结束日期}` 替换；空模板返回空串；自定义分隔符（`{开始日期}/{结束日期}`）。
- `createDefaultDateConfig` 默认值；`resolveDateConfig`：scheme 无 `date` 回退内置默认；部分覆盖（仅 `color`/`fontSize`）沿用全局/内置字号；非法 `date` 回退不崩溃。

**验证**：`pnpm -C apps/bookstore test -- weekly-image-scheme` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 2：layout 产出日期指令（layout.ts，TDD）

扩展 `apps/bookstore/features/schedule/weeklyImage/layout.ts`（对应提案 §5.2 实现点 3）：

1. **新增常量**：`DATE_X=640`、`DATE_Y=80`、`DATE_WIDTH=451`、`DATE_HEIGHT=40`、`DATECONFIG_DEFAULT_FONT_SIZE=20`、`DATECONFIG_MAX_FONT_SIZE=30`、`DATECONFIG_MIN_FONT_SIZE=14`（日期区域更小，shrink 下限低于每日区域的 `MIN_FONT_SIZE=22` 才能有效 shrink）。
2. **`fitToWidth` 参数化下限**：`fitToWidth(text, width, measure, baseFontSize=BASE_FONT_SIZE, minFontSize=MIN_FONT_SIZE)`——既有调用（每日区域）缺省行为不变；日期区域传入 `DATECONFIG_MIN_FONT_SIZE` 作下限。**注意**：现有 `MIN_FONT_SIZE=22 > 日期默认 20`，若不参数化，日期基字号 20 将无法依赖既有 `fitToWidth` 的 shrink/截断逻辑正确工作，故本项目需把下限作为入参（向后兼容，现有调用默认参数不变）。
3. **`layoutWeek` 额外产出日期指令**（签名 `layoutWeek(plans, monday, measure, scheme)` 不变）：
   - 取 `dateConfig = resolveDateConfig(scheme)`；`sunday = toDateStr(…monday + 6 天…)`（解析 `monday` 用 `split("-").map(Number)` + `new Date(y,m-1,d)` 加 6 天，再经 `dateUtils.toDateStr` 回写，不引入日期库）；
   - `startStr = formatDate(monday, dateConfig.format)`；`endStr = formatDate(sunday, dateConfig.format)`；`text = buildDateContent(dateConfig.content, startStr, endStr)`；`text === ""` 则不产出日期指令；
   - 字号 `dateConfig.fontSize`（默认 20）作 `fitToWidth` 基字号（下限 `DATECONFIG_MIN_FONT_SIZE`）；`textWidth = measure(fitted, fontSize)`；`align=dateConfig.align`；`color=dateConfig.color`；
   - 产出 `DrawInstruction { dayIndex: -1, x:DATE_X, y:DATE_Y, width:DATE_WIDTH, height:DATE_HEIGHT, text:fitted, fontSize, align, color, textWidth }`，与按天指令一并返回；`dayIndex=-1` 标记非按天指令。
4. `DrawInstruction` 接口不变（复用既有字段，日期指令仅以 `dayIndex=-1` 语义标记）。

**测试先行** 扩展 `apps/bookstore/tests/unit/weekly-image-layout.test.ts`：
- 存在日期指令：`dayIndex=-1`、坐标 `DATE_X/DATE_Y/DATE_WIDTH/DATE_HEIGHT`；
- 默认方案（无 `date`）日期指令 `text` 为默认内容模板结果、字号 20、`align/color` 随全局（默认左 /`#5b4b68`）；
- `date` 部分覆盖：仅设置 `fontSize`/`color` → 其余沿用全局/内置默认；`align` 覆盖全局；
- 无计划周仍产出日期指令（日期渲染不依赖当周是否有计划）；
- 日期内容模板为空串 → 不产出日期指令；
- 跨年/跨月周开始/结束分别按其真实日期格式化（如周跨 12/31 与 1/1）；
- 长文字 shrink/截断不越界（字号不低于 `DATECONFIG_MIN_FONT_SIZE`，`textWidth ≤ DATE_WIDTH`）。

**验证**：`pnpm -C apps/bookstore test -- weekly-image-layout` 全绿；`pnpm -C apps/bookstore lint` 绿。

### 步骤 3：弹层「日期设置」区块与持久化（WeeklyImageDialog.tsx，TDD）

改 `apps/bookstore/features/schedule/weeklyImage/WeeklyImageDialog.tsx`（对应提案 §5.2 实现点 5）；加载 `docs/design/03-backdoor-design.md`（仅 `@theme` token、后台控件过渡 ≤200ms、尊重 `prefers-reduced-motion`）：

1. **状态**：不新增独立 state；`scheme.date` 复用 `scheme` state。读取时经 `resolveDateConfig` 得有效显示值；编辑在 `scheme.date` 缺失时先以 `createDefaultDateConfig()` 初始化便于表单可编辑。
2. **「日期设置」区块**（置于「全局设置」与「按天设置」之间，`<h3>日期设置</h3>` 起头）：
   - 日期格式模板文本输入框（默认 `{yyyy}年{mm}月{dd}日`）；
   - 日期内容模板文本输入框（默认 `{开始日期} ~ {结束日期}`）；
   - 字号输入（20–30，默认 20）；对齐三选（左/居中/右，默认沿用全局）；颜色色板 + 文本输入（默认 `#5b4b68`）。
3. **`handleDateChange(updates: Partial<DateSchemeConfig>)`**：不可变更新 `scheme.date = { ...createDefaultDateConfig(), ...scheme.date, ...updates }`；复用 `editingDefault` 分支——`true` 时 `saveDefault`、`false` 时 `ensureWeekScheme`+`saveWeek`（与 `handleGlobalChange`/`handleDayChange` 同一套规则，任一日期编辑自动新建本周方案）。
4. **重绘**：既有 `useEffect`（`:96-116`）依赖已含 `scheme`，日期变更触发重算指令并重绘预览，**无需新增依赖**。
5. 对齐/字号/颜色控件复用既有全局设置的 segmented/输入样式与 token；字号输入框加轻量防抖（300ms）防抖动（可选，与全局字号输入保持一致）。

**测试先行** 扩展 `apps/bookstore/tests/unit/schedule-weekly-image-dialog.test.tsx`：
- 「日期设置」区块存在（渲染「日期设置」/「日期格式」/「日期内容」）。
- 改动日期格式 → 屏幕重绘（`renderImage` 再次被调用，断言其最新指令含日期指令且 `text` 按新格式）；`editingDefault=false` 时 `saveWeek` 被调用（自动新建本周方案）、`saveDefault` 未被调用。
- 「编辑默认方案」模式下改日期 → `saveDefault` 被调用、不建周方案。
- 日期配置随方案回显：关层重开 / 切周后回显正确；无周方案周显示默认日期格式。
- 旧版本 scheme（无 `date` 字段）打开弹层不回显崩溃，显示内置日期默认。
- 既有用例（周标签、预览 img、对齐/字号/颜色、按天、恢复默认/预设）保持绿；`renderImage` 桩适配含日期指令。

**验证**：`pnpm -C apps/bookstore test -- schedule-weekly-image-dialog` 全绿；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿。

### 步骤 4：e2e 回归与收尾验收

1. **e2e 回归**（SKILL: z-test，`tests/e2e/`）：既有公开展示/后台直播计划 e2e 不涉本次 `weeklyImage` 日期设置 → 默认回退（无周方案用默认）保证既有断言零回归；可补一条极小的 Playwright「打开生成周表图片弹层 → 改日期格式 → 预览更新」用例（后台弹层交互以单测为主，e2e 仅回归守卫，可选）。
2. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内、按开发分支落地时同步）：
   - `docs/product/spec/schedule-admin.md`：周表图片弹层现态补「日期设置」区块（日期格式/内容模板、字号默认 20、对齐、颜色、随默认 + 按周方案持久化）；
   - `docs/engineering/spec/frontend-bookstore.md`：`weeklyImage/scheme.ts`（`DateSchemeConfig` + `formatDate`/`buildDateContent`/`resolveDateConfig`）与 `layout.ts`（`DATE_*` 常量 + 日期指令 `dayIndex=-1`）现态与口径；
   - 检查 `apps/bookstore/AGENTS.md`「周表 / 直播计划约定」段落是否需同步新口径。
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（日期区域渲染周一~周日、默认格式/内容模板、各变量替换、字号默认 20/对齐/颜色独立生效且不越界、按周保存回显、旧数据回退、`pnpm lint && pnpm test && pnpm build` 全绿）；
4. 推送 `feat/weekly-image-date-render` 并提 PR 至 `prd/weekly-image-date-render`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：既有 `features/schedule/weeklyImage/` 全部实现（`scheme`/`layout`/`renderer`/`storage`/`WeeklyImageDialog`/`weekUtils`）、`dateUtils.toDateStr`、Zod v4；**无日期库**（自实现与既有风格一致）；**无 lodash**（`structuredClone`）。
- **并行协调**：唯一开发分支 `feat/weekly-image-date-render`；依赖链明确（scheme → layout → 弹层），subagent 串行；renderer 零改动、契约/服务端/编排零变更，无可并行后端任务。
- **风险**（对应提案 §5.2 与 §6.1）：
  - **`fitToWidth` 下限不匹配**：既有 `MIN_FONT_SIZE=22` 高于日期基字号 20，须把下限参数化（`DATECONFIG_MIN_FONT_SIZE=14`）才能在日期区域正确 shrink/截断不越界；既有调用缺省不变，防回归。
  - **旧数据兼容**：`DateSchemeConfigSchema` 全字段可选回退，`DefaultSchemeSchema.date.optional()` 保证旧 `localStorage` 数据 `safeParse` 成功，`resolveDateConfig` 补默认不崩溃。
  - **自动新建周方案时序**：日期编辑先 `ensureWeekScheme`（以当前有效方案为基底复制）再写变更，避免默认方案被「周编辑」污染；`editingDefault` 模式隔离不建周方案。
  - **重绘频率**：日期输入击键重绘单次 Canvas 可接受，如抖动明显对字号/模板输入加 300ms 防抖；`scheme` 引用变化驱动重绘。
  - **坐标归属**：日期区域坐标 `(640,80)/451×40` 来自 `feat/weekly-image-date-area`（当前需求总分支资源 AGENTS.md 缺该行，步骤 0 补齐）；底图须同源分发（跨域污染画布）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-24-weekly-image-date-render-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-24-weekly-image-date-render-proposal.md]]（v1.0）
- 先决需求：[[../../product/requirements/draft/2026-08-24-weekly-image-customization-prd.md]]
- 上一迭代实现方案：[[2026-08-24-weekly-image-customization-impl-plan.md]]
- 前端规范：[[../frontend-rules.md]]、后端规范：[[../backend-rules.md]]
- 后台设计：[[../../design/03-backdoor-design.md]]
- 产品 Spec（现态）：`docs/product/spec/schedule-admin.md`
- 素材坐标：`public/assets/original/AGENTS.md`（日期区域 640,80 / 451×40）
