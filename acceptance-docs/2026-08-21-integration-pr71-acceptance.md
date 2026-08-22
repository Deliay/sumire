# Integration 验收报告 — PR #71

- **PR**: https://github.com/Deliay/sumire/pull/71 （integration → release，mergeable: MERGEABLE）
- **审查范围**: `git diff release..integration`（13 文件，+906/-26；`integration..release` 反向仅剩 release 侧历史合并，无独有代码）
- **包含功能**: 弹幕检索 v2——检索入口提升为 SideNav 一级菜单项 + 最长前缀匹配选中态；检索结果按 `event.type` 分发渲染（复用看板四类条目组件，只读口径）；`SuperChatItem` 新增可选 `highlightKeyword`（PRD `docs/product/requirements/draft/2026-08-20-danmaku-search-v2-prd.md`，提案 `docs/engineering/proposals/2026-08-20-danmaku-search-v2-proposal.md`，实现方案 `docs/engineering/plans/2026-08-20-danmaku-search-v2-impl-plan.md`）
- **验收日期**: 2026-08-21
- **验收结论**: ✅ **通过** —— 无 Blocker / Major；4 项 Minor 记录于下，不阻塞合入

## 测试验证结果

| 套件 | 命令 | 结果 |
|---|---|---|
| bookstore lint | `pnpm -C apps/bookstore lint` | ✅ 0 error（3 个既有 warning，非本 PR 引入） |
| bookstore 单元测试 | `pnpm -C apps/bookstore test` | ✅ 43 文件 360/360 通过（含新增 sidenav 选中态 7 例、SearchResultCard 分发 7 例、SC 高亮 2 例） |
| bookstore 构建 | `pnpm -C apps/bookstore build` | ✅ 静态导出 14 路由全部生成 |
| api 单元测试 | `pnpm -C servers/api test` | ✅ 13 文件 222/222 通过 |
| e2e（Playwright，Aspire 编排全栈实跑） | `BOOKSTORE_BASE_URL=… API_BASE_URL=… pnpm test` | ✅ 49 通过 / 8 跳过（含新增 `danmaku-search-v2-nav-entry-active-state`、`danmaku-search-v2-mixed-results` 两例实跑通过） |

## 问题清单

### Blocker

无。

### Major

无。

### Minor

| # | 位置 | 问题 |
|---|---|---|
| m1 | `apps/bookstore/AGENTS.md`、`docs/engineering/spec/frontend-bookstore.md` | 选中态描述为「`pathname.startsWith(href)` + href 长度降序」，实现实为 `pathname === href \|\| pathname.startsWith(href + "/")` 取最长（`SideNav.tsx:30-32`）。对现有菜单项行为等价，仅文档措辞不精确 |
| m2 | `tests/e2e/src/backdoor/danmaku.spec.ts:648-689` | 混合类型 e2e 中礼物/上船的样式断言落在看板页而非检索结果页——stub 检索按 content 匹配，礼物/上船无 content 字段无法命中检索，属测试环境限制；检索页礼物/上船分发分支由单测（`danmaku-search-result-card.test.tsx`）覆盖，可接受 |
| m3 | `apps/bookstore/features/danmaku/components/SuperChatItem.tsx:63-71` | 高亮分支下 `BiliVideoLink` 链接化让位（含 B 站链接的 SC 在检索结果中退化为纯文本不可点击）。提案 §5.2 实现点 3 已明确「检索场景高亮优先」的取舍，记录为已知行为 |
| m4 | `docs/product/requirements/draft/`、`docs/engineering/proposals/`、`docs/engineering/plans/` | follow-up（非当前违规）：danmaku-search-v2 的 PRD/proposal/impl-plan 在本 PR 合入 release 后即满足归档条件（已上线 + 被 spec 收录），应移入各自 `archived/` |

## 与 PRD 的差距

**弹幕检索 v2 PRD**（§1.3 成功标准 / F1 / F2 验收标准逐条核对）：

- F1 导航一级入口：SideNav 新增「弹幕检索」（位于「弹幕看板」之后，superadmin/admin/member 可见）✓ 单测 + e2e 实跑验证
- F1 选中态互不干扰：最长前缀匹配，`/backdoor/danmaku/search` 仅检索高亮、`/backdoor/danmaku` 仅看板高亮 ✓（单测 7 路径 + e2e 浏览器实跑双向验证）
- F2 按类型分发：`danmaku` 保持 v1 卡片、`super_chat` → `SuperChatItem`（+`<mark>` 高亮）、`gift` → `GiftItem`、`guard_buy` → `GuardItem`，未知类型兜底弹幕卡片不抛错 ✓（单测逐类型覆盖）
- F2 SC 留言命中关键词高亮、罗马音行不高亮 ✓；弹幕高亮 v1 行为无回归 ✓
- F2 只读口径：不传 `onToggleRead`、`isNew=false`，无双击已读 / 无「New」标记 / 无合并计数 ✓（单测断言 `cursor-pointer` 缺失）
- 看板侧零回归：`highlightKeyword` 缺省路径输出与现态一致（单测锁定）；看板既有 e2e（已读/分栏/合并/动画）全部通过 ✓
- 成功标准「与既有弹幕看板、检索 v1 零回归」✓（360 单测 + 49 e2e 全绿）

无差距项。

## 合规性审查（文档/spec/e2e）

- spec 同步：`docs/product/spec/danmaku.md`（一级入口、按类型分发、SC 高亮、只读口径）与 `docs/engineering/spec/frontend-bookstore.md`（SideNav 最长前缀匹配、`SearchResultCard` 分发器、`SuperChatItem.highlightKeyword`）均与代码现态一致 ✓（同时顺手清除了 release 侧 danmaku.md 行尾残留的多余 `"`）
- `apps/bookstore/AGENTS.md` 同步准确（NAV_ITEMS 5 项、分发口径、highlightKeyword 入参）✓
- e2e 变更为合理的现态对齐：既有检索用例改从导航进入（入口提升的必然适配），删除「搜索中…」瞬态断言（防抖下不稳定），新增两例用真实浏览器断言选中态类名与混合渲染，质量良好 ✓
- 上期验收（PR #63）follow-up 核对：M2（gift_v2 API 集成测试）、M3（路由层 SSE 扩参 / 400 / 归一化用例）、m1（DanmakuItem 注释 0.5%→10%）、m9（backend-live.md 信封 type 措辞）均已在 release 侧修复并随 PR #68 合入 integration ✓

## 结论与建议

**验收通过。** 本期为纯前端变更，实现与 PRD/提案/实现方案三者一致，单测与 e2e（Aspire 全栈实跑）全绿，spec 与 AGENTS.md 同步到位，上期遗留 follow-up 全部闭环。建议合入 release。

Follow-up（不阻塞本次合入）：

1. m4：合入后归档 danmaku-search-v2 的 PRD / proposal / impl-plan 至各自 `archived/`。
2. m1：AGENTS.md 与 frontend-bookstore.md 的选中态措辞可随手对齐实现口径。
