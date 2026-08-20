# Integration 验收报告 — PR #63

- **PR**: https://github.com/Deliay/sumire/pull/63 （integration → release，mergeable: CLEAN，无 CI 状态检查）
- **审查范围**: `git diff origin/release..origin/integration`（35 文件，+2274/-86）
- **包含功能**: ① 弹幕看板视觉优化（前端，PRD `docs/product/requirements/draft/2026-08-19-danmaku-board-visual-polish-prd.md`）；② 礼物事件 gift_v2 支持（后端，PRD `docs/product/requirements/draft/2026-08-20-gift-v2-prd.md`）
- **验收日期**: 2026-08-20
- **验收结论**: ✅ **通过（附 follow-up）** —— 原 blocker B1（reduced-motion 降级缺失）经产品侧裁定：该 PRD 验收标准暂时去掉、本次可不修（2026-08-20 返工轮），降级为 follow-up 记录；其余 3 个 major 作为 follow-up 跟踪，不阻塞合入
- **修订记录**: 2026-08-20 返工轮 —— B1 由 Blocker 改判为「已豁免（Won't-fix-now）」，结论由「不通过」改为「通过（附 follow-up）」

## 测试验证结果

| 套件 | 命令 | 结果 |
|---|---|---|
| bookstore 单元测试 | `pnpm -C apps/bookstore test` | ✅ 40 文件 321/321 通过 |
| api 单元测试 | `pnpm -C servers/api test` | ✅ 13 文件 217/217 通过 |
| api 类型检查 | `pnpm -C servers/api lint` (tsc --noEmit) | ✅ 通过 |
| e2e（Playwright） | 未运行（需 Aspire 编排全栈） | 已做静态审查，断言与实现匹配 |

## 问题清单

### Blocker

无。（原 B1 经产品侧裁定豁免，见下）

### 已豁免（Won't-fix-now）

**B1. `prefers-reduced-motion` 降级完全缺失（原 Blocker，2026-08-20 产品侧裁定：该要求暂时去掉，本次不修）**

- 位置：`apps/bookstore/app/globals.css:136-156`、`apps/bookstore/features/danmaku/components/FeedSection.tsx:169-185`
- 原 PRD 依据：弹幕看板视觉优化 PRD F1 验收标准「`prefers-reduced-motion` 下无任何动效」、§5.2 约束「遵循 `prefers-reduced-motion`」——该验收标准已被产品侧暂时去掉，不再作为合入门槛。
- 现状：全仓 `motion-reduce` 零命中；原先 globals.css 中兜底的全局规则（`@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; ... } }`）在本分支被删除（commit d58cd79），只保留对氛围动效（fog/vine-draw）的关闭。reduced-motion 用户下入场动画（50ms）与平移过渡照常播放。
- 遗留风险（follow-up）：旧全局规则同时压制站内其它动效（`--animate-rise` 0.6s、`--animate-pulse` 3.2s infinite、各 `transition-colors` 等），删除后这些动效在 reduced-motion 下全部恢复播放——全站范围的 a11y 回退，建议后续恢复降级能力时一并处理。
- 注：`docs/engineering/spec/frontend-bookstore.md` 已把「reduced-motion 不做全局时长覆盖」写为现态，spec 与当前裁定口径一致。

### Major

**M1. 范围蔓延：未评审的「回放测试」调试功能进入 PR**

- 位置：`apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx:48-52,311-340`、`apps/bookstore/app/backdoor/(dashboard)/danmaku/page.tsx:34-47,71-84`
- PRD/提案/实现方案均无此功能。`DanmakuDashboard` 被改为 `forwardRef` + `useImperativeHandle` 暴露 `replayTest`（拉 100 条历史、改 eventId 后缀、逐条注入 `handleStreamEvent`），页面在 `NODE_ENV === "development"` 时渲染 4 个回放按钮。
- 按钮仅 dev 显示、生产构建会内联掉，运行时风险有限；但生产组件上新增了命令式调试 API 与假数据注入路径（真实写入 `eventsBySection`/已读计数等状态），属未评审变更。`apps/bookstore/AGENTS.md` 已将其写为既定事实，说明是有意加入。建议拆出独立评审或在提案中补录追认。

**M2. gift_v2 的 API 集成测试完全未增补（实现方案步骤 3 未执行）**

- 位置：`tests/api/src/live-events.test.ts`（本 PR 零改动，全目录 grep `gift_v2` 无匹配）
- 依据：`docs/engineering/plans/2026-08-20-gift-v2-impl-plan.md` 步骤 3 要求增补集成用例。缺口包括：stub 收到 `type=gift&type=gift_v2` 扩参、gift_v2 事件经检索/SSE 出口为 `type:"gift"`、gift_v2 来源事件已读链路（POST /read → read:true）。
- 后果：PRD 成功标准「检索同时返回 gift 与 gift_v2、SSE 同理」「gift_v2 支持双击已读」目前仅有单测级证据，无集成级验证。

**M3. 后端路由层关键路径无测试覆盖**

- 位置：`servers/api/tests/liveEvents.test.ts`（diff 仅更新 4 处既有 `fetchRange` 断言，未新增用例）
- 缺口：① SSE `subscribe` 扩参断言（`servers/api/src/routes/liveEvents.ts:189-191` 的 SSE 扩参代码路径完全无测试）；② `?type=gift_v2` → 400 的回归保护；③ gift_v2 信封经检索出口为 `type:"gift"` 且已读合并的路由级用例。

### Minor

| # | 位置 | 问题 |
|---|---|---|
| m1 | `apps/bookstore/features/danmaku/components/DanmakuItem.tsx:24-25` | JSDoc 仍写背景透明度「0.5%」，实际实现为 10%（`bg-eye/10`），注释与实现不符 |
| m2 | `apps/bookstore/features/danmaku/useAnchoredFeed.ts:63-70` | 挂账机制不区分 prepend 与分页 append：append 也累积挂账，之后总高回缩时会在挂账额度内回退 scrollTop，与注释「无挂账的回缩不调整」的保护意图存在缝隙（实际影响轻微） |
| m3 | `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx:267-284` | `inserted` 判定基于 ref 镜像，同一渲染批次内到达的重复 eventId 会被误判为 inserted，导致已存在的旧行重播入场动画（上游有 eventId 去重，触发概率低） |
| m4 | `servers/api/tests/liveEventsNormalize.test.ts:488-502` | 畸形 gift_v2 → null + console.warn 未加入既有表格用例；eventId 稳定性断言只覆盖 danmaku，未覆盖 gift_v2 |
| m5 | `servers/api/src/liveEvents/normalize.ts:279-301` | medal 提取逻辑出现第三份拷贝（v2 分支与 `medalFromMedalInfo` 语义重复；因字段命名 camelCase/snake_case 差异无法直接复用，属合理偏离，建议后续收敛） |
| m6 | `docs/product/requirements/draft/` 两份新 PRD | 功能已开发完成待上 release，PRD 仍滞留 `draft/` 且无 `status:` 头部标注（依据 requirements/README.md:11-15）。注：与目录内既有执行口径一致，非本 PR 新引入 |
| m7 | follow-up（非当前违规） | PR #63 合入 release 后，两份 PRD + 两份 proposal 即满足归档条件（已上线 + 被 spec 收录），应移入各自 `archived/` |
| m8 | 根 `AGENTS.md` | 「文档结构」一节未收录 `docs/engineering/plans/`（该目录由 proposals/README.md:3 定义且已有 10 份文件），非本 PR 引入 |
| m9 | `docs/engineering/spec/backend-live.md:22` | 「B 站原始 cmd（…SEND_GIFT_V2…）」措辞未经证实——代码实际按上游信封 `type: "gift_v2"` 识别（normalize.ts:353,369），建议改为「信封 type」口径 |
| m10 | `contract/live-events.openapi.yaml:189,193,239` | 契约描述文本残留旧口径（eventId 派生只写 v1 规则、cmd 列表无 v2）。契约 schema 零变更是 PRD 硬约束、判定正确；描述文本无行为分歧，且派生口径已由 backend-live.md 收录，事实源未丢失 |

## 与 PRD 的差距

**弹幕看板视觉优化 PRD**：

- F1「reduced-motion 下无任何动效」——未实现（见 B1），但该验收标准已被产品侧暂时去掉（2026-08-20 裁定），不再计入硬性达标口径，转为 follow-up
- F1 入场/平移时长：提案口径 200ms → 实际 50ms（commit df419e7）。PRD 仅要求「短时长、克制」，字面达标；50ms（约 3 帧）的可感知性建议人工盯屏确认
- F4 背景透明度：PRD/提案原文 0.5% → 实际 10%（commit c192a61 注明「0.5% 实际不可见」）。PRD 允许评审调档且 spec 已同步，属有记录的有意偏差，需产品侧追认
- 范围外变更两处：dev 回放测试按钮（M1）、GiftItem 布局调整（commit f8eac4a，不属任一 PRD）
- 其余验收点（F2 合并开关默认关闭/持久化/损坏回退/不重新检索、F3 SC 可选中复制/双击隔离、F4 三档 tint、F1 历史首屏不动画/挂账锚定/离顶禁过渡）核对均达标，单测覆盖与 PRD 验收点一一对应

**gift_v2 PRD**：

- F1 归一化（字段口径、eventId 稳定、畸形跳过告警）——实现 ✓，测试有小缺口（m4）
- F2 检索与 SSE 并入 gift 流——实现 ✓，SSE 扩参与 `type=gift_v2`→400 无测试（M3）
- F3 既有 gift 行为兼容——代码路径兼容 ✓，已读链路无 gift_v2 集成用例（M2）
- 契约/前端零变更——✓ 符合硬约束
- 既有四类零回归——✓ 217 用例全绿

## 合规性审查（文档/spec/e2e）

- spec 同步（danmaku.md / frontend-bookstore.md / backend-live.md）与代码现态逐条一致 ✓
- `apps/bookstore/AGENTS.md`、`servers/api/AGENTS.md` 同步准确 ✓
- e2e 变更（`tests/e2e/src/backdoor/danmaku.spec.ts`）为合理的现态对齐，未删有效断言；新增入场动画用例用真实浏览器 Animation API 断言，质量良好 ✓
- `docs/engineering/plans/` 目录合规（proposals/README.md:3 明确定义）✓

## 结论与建议

**验收通过（附 follow-up）。** 核心功能实现质量良好、单测全绿、spec 同步到位。原 Blocker B1 经产品侧裁定：reduced-motion 验收标准暂时去掉、本次不修（2026-08-20），不再阻塞合入；其全站 a11y 回退风险记录为 follow-up。

Follow-up 建议（不阻塞本次合入）：

1. **B1 遗留风险**：reduced-motion 下全站动效（rise/pulse/各过渡）无降级，后续恢复可访问性降级能力时需覆盖本功能动效与站内既有动效，并补测试。
2. **建议补齐 M2/M3**：gift_v2 集成用例与 SSE 扩参/400 单测；如决定携带缺口上线，需在 PR 中明确记录并建 follow-up。
3. **需产品/技术负责人裁决 M1**：回放测试按钮与 GiftItem 布局调整两处范围外变更，拆出或书面追认。
4. minor 项（m1 注释、m9 spec 措辞）建议随手修复；m7 归档在合入后执行。
