# PR #63 验收问题修复方案

- **修复日期**: 2026-08-20
- **关联验收报告**: `acceptance-docs/2026-08-20-integration-pr63-acceptance.md`
- **修复范围**: Major M1, M2, M3 + Minor m1, m9

## 修复计划

### Major M1: 回放测试调试功能范围蔓延

**问题**: `DanmakuDashboard` 被改为 `forwardRef` + `useImperativeHandle` 暴露 `replayTest` API，页面在 `NODE_ENV === "development"` 时渲染 4 个回放按钮。PRD/提案/实现方案均无此功能。

**修复方案**: 
1. 移除 `DanmakuDashboard` 中的 `forwardRef` + `useImperativeHandle` 和 `replayTest` 方法
2. 移除开发环境回放测试按钮
3. 恢复 `DanmakuDashboard` 为普通组件

**影响文件**:
- `apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx`
- `apps/bookstore/app/backdoor/(dashboard)/danmaku/page.tsx`

### Major M2: gift_v2 集成测试缺失

**问题**: `tests/api/src/live-events.test.ts` 零改动，缺少 gift_v2 集成用例。

**修复方案**:
1. 在 `tests/api/src/live-events.test.ts` 中新增 gift_v2 集成测试用例
2. 测试内容：
   - stub 收到 `type=gift&type=gift_v2` 扩参
   - gift_v2 事件经检索/SSE 出口为 `type:"gift"`
   - gift_v2 来源事件已读链路（POST /read → read:true）

### Major M3: 后端路由层关键路径无测试覆盖

**问题**: `servers/api/tests/liveEvents.test.ts` 未新增用例，缺少 SSE `subscribe` 扩参断言、`?type=gift_v2` → 400 的回归保护、gift_v2 信封经检索出口为 `type:"gift"` 且已读合并的路由级用例。

**修复方案**:
1. 在 `servers/api/tests/liveEvents.test.ts` 中新增测试用例
2. 测试内容：
   - SSE `subscribe` 扩参断言（验证 `type=gift` 扩展为 `["gift", "gift_v2"]`）
   - `?type=gift_v2` → 400 的回归保护
   - gift_v2 信封经检索出口为 `type:"gift"` 且已读合并的路由级用例

### Minor m1: DanmakuItem.tsx JSDoc 注释不符

**问题**: JSDoc 仍写背景透明度「0.5%」，实际实现为 10%（`bg-eye/10`）。

**修复方案**: 更新 JSDoc 注释，将 0.5% 改为 10%。

### Minor m9: backend-live.md 措辞问题

**问题**: 「B 站原始 cmd（…SEND_GIFT_V2…）」措辞未经证实——代码实际按上游信封 `type: "gift_v2"` 识别。

**修复方案**: 将 `docs/engineering/spec/backend-live.md` 中的措辞改为「信封 type」口径。

## 执行步骤

1. 更新修复文档（本文档）
2. 修复 Major M1: 移除回放测试功能 ✅
3. 修复 Major M2: 补充 gift_v2 集成测试 ✅
4. 修复 Major M3: 补充后端路由层测试 ✅
5. 修复 Minor m1: 更新 JSDoc 注释 ✅
6. 修复 Minor m9: 更新 spec 措辞 ✅
7. 运行所有测试确保通过 ✅
8. 提交修复

## 修复结果

- bookstore 单元测试: 321/321 通过
- api 单元测试: 222/222 通过
- lint 检查: 通过（仅 warnings，无 errors）
- tsc 类型检查: 通过