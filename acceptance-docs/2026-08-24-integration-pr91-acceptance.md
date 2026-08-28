# Integration 验收报告 — PR #91

- **PR**: https://github.com/Deliay/sumire/pull/91 （integration → release）
- **审查范围**: `git diff release...integration`（17 文件，+1916/-22；含返工提交 `1ec2ded`）
- **包含功能**: 周表图片自定义——`features/schedule/weeklyImage/` 新增 `scheme.ts`（Default/Week 两套方案 schema + `resolveEffectiveScheme`/`buildDaySchedulesText`/`resolveDayText`）、`storage.ts`（localStorage + 内存回退）、`layout.ts`/`renderer.ts` 扩展自定义文本渲染，`WeeklyImageDialog.tsx` 支持自定义（PRD `docs/product/requirements/draft/2026-08-24-weekly-image-customization-prd.md`，提案 `docs/engineering/proposals/2026-08-24-weekly-image-customization-proposal.md`，实现方案 `docs/engineering/plans/2026-08-24-weekly-image-customization-impl-plan.md`）
- **验收日期**: 2026-08-24
- **验收结论**: ✅ **通过** —— 3 类 TS 类型错误修复已提交并推送 origin/integration（`1ec2ded`），integration 前移含修复；各套件全绿，PR #91 可合入 release
- **修订记录**: 2026-08-24 首轮验收发现 3 类 TS 类型错误（`saveToStorage` 泛型过宽、StreamPlan fixture 缺 `id`/`createdAt`、`invalidScheme` cast）打回；第二轮竞验收时修复已提交但未推送，打回要求补提交；本轮核对 origin/integration 已含修复提交并全绿通过

## 本轮复验（2026-08-24，通过）

核对 origin/integration 提交态（`1ec2ded` / `HEAD=origin/integration`）三处修复均已落入：

| # | 返工要求 | 提交态现况 | 结论 |
|---|---|---|---|
| 1 | `storage.ts` `saveToStorage` 泛型收窄为 `DefaultScheme \| WeekScheme` | `storage.ts:48` `saveToStorage<T extends DefaultScheme \| WeekScheme>` | ✅ 已修复 |
| 2 | 两个测试文件 StreamPlan fixture 补齐 `id`/`createdAt` | `weekly-image-layout.test.ts` 9 处、`weekly-image-scheme.test.ts` 4 处 fixture 均补全 | ✅ 已修复 |
| 3 | `scheme.test.ts` `invalidScheme` cast 为 `unknown as WeekScheme` | `weekly-image-scheme.test.ts:61` | ✅ 已修复 |

`git log origin/release..origin/integration --oneline` 显示 integration 较 release 共 12 个提交，最新为 `1ec2ded fix: resolve TS type errors in weeklyImage module`，修复内容已在被合入的提交中，不再丢失。

## 测试验证结果（origin/integration 提交态）

| 套件 | 命令 | 结果 |
|---|---|---|
| bookstore 单元测试 | `pnpm -C apps/bookstore test` | ✅ 53 文件 **506/506** 通过（周表图片 5 文件全过） |
| bookstore lint | `pnpm -C apps/bookstore lint` | ✅ 0 error（2 个既有 warning：GiftItem/home-weekly-guard `<img>`，非本 PR 引入） |
| bookstore 类型检查 | `npx tsc --noEmit` | ⚠ 仅基线既有错误 3 处（`DanmakuDashboard.tsx` ×2、`danmaku-use-hover-pills.test.tsx` ×1），**非本 PR 引入**（详见下） |

## 关于弹幕基线 tsc 错误的说明

- integration 分支 `tsc --noEmit` 报 3 处弹幕模块既有类型错误（`DanmakuDashboard.tsx:249/711`、`danmaku-use-hover-pills.test.tsx:105`）。
- 经查，这 3 处错误由 **release 侧的修复提交 `63fabf8`**（`fix: resolve TypeScript build errors in DanmakuDashboard and hover pills test`）解决，而该提交位于 `origin/integration..origin/release`，**integration 未包含**。
- 本 PR（周表图片自定义）的提交范围 `release..integration` **未改动**这些弹幕文件（`git log release..integration -- <danmaku文件>` 为空）。合并 integration→release 为无冲突干净合并，release 侧的弹幕修复版本将保留，合并结果弹幕类型干净。
- 结论：属 PR 范围外基线差异，不阻塞本 PR 验收；仅提示后续 integration 宜定期合并 release 以消除基线差异。

## 问题清单

### Blocker

无。

### Major

无。

### Minor

无。

## 与 PRD 的差距

周表图片自定义 PRD 验收要点复核（周表图片生成既有能力 + 自定义扩展）：

- 自定义文本渲染（`{schedules}` 变量替换、纯自定义字符天渲染、恢复方案按钮、默认色 `#5b4b68`）：✓ 代码已实现，周表图片单测覆盖
- 既有能力零回归：✓ 其余单测全绿 + lint 0 error

差距项：无功能差距。

## 合规性审查（文档/spec/契约）

- spec 同步：`docs/engineering/spec/frontend-bookstore.md`（周表图片段）、`docs/product/spec/schedule-admin.md`（生成周表图片按钮口径）已随 PR 更新 ✓
- PRD/proposal/impl-plan 三件套已随 PR 合入 ✓

## 结论与建议

**验收通过。** 3 类 TS 类型错误修复已提交并推送 origin/integration（`1ec2ded`），506 单测与 lint 全绿；仅剩的弹幕 tsc 错误为 PR 范围外基线差异（release 已修复，合并不受影响）。PR #91 可合入 release。
