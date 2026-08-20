---
description: 礼物事件 gift_v2 支持实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划（单一开发分支 feat/gift-v2：实测样本采集前置，normalizeGiftV2 归一化与路由层 toUpstreamTypes 扩参 TDD，API 集成测试增补 gift_v2 来源用例；分支策略、TDD 步骤、验证与验收）
type: Permanent
---

# 礼物事件 gift_v2 支持 实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-08-20-gift-v2-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-08-20-gift-v2-proposal.md]]（v1.0）
**关联契约**: `contract/live-events.openapi.yaml`（**本期不变**，对前端透明是硬约束）
**需求总分支**: `prd/gift-v2`
**开发分支**: `feat/gift-v2`（自需求总分支切出，**唯一开发分支**）
**版本**: v1.0（2026-08-20）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划。本期为**纯服务端改造**：归一化层识别 `gift_v2` 信封并入既有 gift 事件流，路由层向上游请求时把契约 `gift` 展开为 `["gift", "gift_v2"]`；契约、前端、数据库零变更。**前提事实**（已在需求总分支 `prd/gift-v2` 核对代码现态）：

- `servers/api/src/liveEvents/normalize.ts:38` `EVENT_TYPES` 现仅四类；`:206-236` `normalizeGift` 为字段口径基准（eventId `gift:{batch_combo_id ?? combo_id}`、金瓜子 `combo_total_coin ?? discount_price`/1000、银瓜子记 0、`img_basic` 缺位不下发 `iconUrl`、`medalFromMedalInfo`/`guardLevelFromUinfo` 复用点）；`:268-296` `toLiveEvent` 按信封 `type` 分发（`:282-289`），未知类型走 `:293` console.warn + null 不中断流；
- `servers/api/src/routes/liveEvents.ts:29-40` `parseTypesParam` 按契约四类校验（`gift_v2` 作为查询参数非法仍 400，天然满足）；`:110-112` 检索路由 `fetchRange(types.types, …)`、`:183` SSE `subscribe(types.types, …)` 为仅有的两处上游调用点；`:239` read-all `fetchRange([type], …)` 仅支持 super_chat/guard_buy，不涉及；
- `servers/api/src/liveEvents/upstream.ts:35-39` `buildUrl` 以 `searchParams.append("type", t)` 拼重复 `type=` 参数，多类型天然支持——**上游客户端零改动**；
- 测试基底：`servers/api/tests/liveEventsNormalize.test.ts:67-107,358-386` gift 归一化用例区与 `:5` 夹具引入模式（`tests/fixtures/live-events/gift.json` 同目录新增 `gift_v2.json`）；`servers/api/tests/liveEvents.test.ts:239,295` 全类型/多类型 fetchRange 断言、`:313-337` minPrice 系列断言（`["gift"]` 调用参数将随扩参变为 `["gift", "gift_v2"]`，见步骤 2 回归说明）；`tests/api/src/live-events.test.ts:87-109` stub `gift(i, min)` 构造器、`:131-147` 确定性数据集与 `filterByTypes`、`:154-195` stub 服务（range 回显查询串、subscribe 记录 `lastSubscribeTypes`）。

整体顺序：**切开发分支 → 实测样本采集（开发前置）→ 后端归一化与扩参（TDD）→ API 集成测试增补 → 收尾验收**。单一开发分支 `feat/gift-v2` 共享，各实现 subagent **串行执行**（字段映射依赖实测样本，API 测试依赖后端就绪）。

## 1. 现状与差距（主线现状 → 本期目标）

| 项 | 现状（已核对） | 本期目标（依据提案 v1.0） |
|----|-----------------|---------------------------|
| 归一化 | `EVENT_TYPES` 四类，`gift_v2` 信封命中「未知事件类型」被丢弃 + warn | `EVENT_TYPES` 增 `"gift_v2"`；新增 `normalizeGiftV2` 产出 `type: "gift"` LiveEvent；`toLiveEvent` 增分发分支 |
| 上游请求 | 契约 type 原样透传（`fetchRange`/`subscribe`） | 路由层新增 `toUpstreamTypes`：`gift` → `["gift", "gift_v2"]`，检索/SSE 两处统一走 |
| 契约 | `GET /api/live-events` type 枚举四类 | **零变更**；`type=gift_v2` 查询仍 400 |
| 前端/DB | 弹幕看板消费 gift 事件流；已读按 eventId `gift:` 前缀 | **零变更**；gift_v2 来源事件 eventId 沿用 `gift:` 前缀，已读/minPrice/配色天然生效 |
| 测试 | 三层测试全绿 | 增量：gift_v2 实测样本夹具 + 归一化单测 + 路由扩参单测 + API 集成用例；既有用例零回归（仅扩参相关断言按新口径更新） |

## 2. 分支与提交

- 实现计划文档（本文档）直接提交到需求总分支 `prd/gift-v2`；
- 开发工作（样本夹具、后端实现、测试）全部在**唯一开发分支** `feat/gift-v2` 上进行（自 `prd/gift-v2` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息格式 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步。

## 3. 实施步骤

### 步骤 0：创建开发分支并同步基线

- 自 `prd/gift-v2` 切出 `feat/gift-v2`（含 PRD v1.0、提案 v1.0 与本文档），确认无冲突。

**验证**：`git status` 干净，位于 `feat/gift-v2`。

### 步骤 1：gift_v2 实测样本采集与字段映射定稿（开发前置）

对应提案 §5.2 实现点 1。

1. 经 `GET http://vtuber.internal.fffdan.com/api/b/live/1727076670/event/range?type=gift_v2`（或 subscribe 抓帧）获取真实 gift_v2 信封；
2. 样本落盘 `servers/api/tests/fixtures/live-events/gift_v2.json`（与既有 `gift.json` 同目录同形态：完整上游信封），覆盖：金瓜子/银瓜子、有无连击标识、有无图标字段；
3. 样本字段与 `normalizeGift` 所用字段（`data.uname`/`data.img_basic`/`data.combo_total_coin`/`data.batch_combo_id`/`data.medal_info`/`data.uinfo` 等）逐一比对，**在 PR 描述或提案评审记录中定稿字段映射表**（eventId 等价连击标识、金额字段、牌子/上船结构是否为 uinfo 形态）；
4. **若上游尚未实际下发 gift_v2**：以接口声明的 schema 落夹具并在单测断言，PR 中显式标注「上线前以真实流量回归验证」（提案 §5.2 风险点口径）。

**验证**：夹具文件落盘且为合法 JSON；字段映射表定稿（normalizeGiftV2 的每一行映射都能指到样本字段）。

### 步骤 2：后端归一化与路由扩参（subagent，TDD）

加载 `servers/api/AGENTS.md`、`docs/engineering/backend-rules.md` 与契约。全程 TDD：先失败测试再实现。改动面：

1. 单测先行：
   - `tests/liveEventsNormalize.test.ts`（仿 `:67-107` gift 用例区）：合法 gift_v2 样本 → `type: "gift"`、eventId `gift:` 前缀且稳定（同一样本重复归一化 eventId 相同）、金额/图标/牌子/上船等级口径与 normalizeGift 一致；缺图标 → 不下发 `iconUrl`；银瓜子 → `price: 0`；畸形/缺关键字段 → null + console.warn（并入 `:404` 既有表格用例模式）；
   - `tests/liveEvents.test.ts`：`?type=gift` 检索 → `fetchRange` 收到 `["gift", "gift_v2"]`；缺省全类型 → 收到 `["danmaku", "super_chat", "gift", "gift_v2", "guard_buy"]`；`?type=danmaku` → 不含 `gift_v2`；SSE `subscribe` 同样扩参；`type=gift_v2` 查询 → 400；gift_v2 信封经检索出口为 `type: "gift"` 且已读合并正常（stub `fetchRange` 返回 gift_v2 信封，断言响应 items）；
   - **既有断言按新口径更新**（扩参的必然结果，非逻辑变更）：`:295` 全类型断言、`:319/328/337` minPrice 系列 `["gift"]` → `["gift", "gift_v2"]`；`:239`（danmaku+super_chat）、`:464`（read-all super_chat）不受影响；
2. `src/liveEvents/normalize.ts`：`EVENT_TYPES`（`:38`）增 `"gift_v2"`；新增 `normalizeGiftV2(payload, occurredAt)`（紧随 `normalizeGift` `:236` 之后），字段映射以步骤 1 定稿为准、口径对齐 `normalizeGift`——eventId 优先 v2 等价连击去重标识，无等价字段回退 `gift:{uid}:{giftId}:{timestamp}`；金瓜子等价字段 /1000、银瓜子记 0；`iconUrl` 缺位不下发；牌子/上船为 uinfo 结构则复用 `medalFromMedalInfo`/`guardLevelFromUinfo`；防御式解析失败返回 null；`toLiveEvent`（`:282-289`）增 `gift_v2 → normalizeGiftV2` 分发分支；
3. `src/routes/liveEvents.ts`：新增内部纯函数（与 `parseTypesParam` 同级，`:40` 之后）：

   ```ts
   /** 契约 type → 上游 type 查询参数：gift 并入 gift_v2 来源（前端透明）。 */
   function toUpstreamTypes(types: string[]): string[] {
     return types.flatMap((t) => (t === "gift" ? ["gift", "gift_v2"] : [t]));
   }
   ```

   检索（`:110-112`）与 SSE（`:183`）两处调用点改为 `toUpstreamTypes(types.types)`；`parseTypesParam` 不变（契约口径校验，`gift_v2` 查询仍 400）；read-all（`:239`）不改；
4. `src/liveEvents/upstream.ts` **零改动**（`buildUrl` 多 type 重复参数天然支持）；无契约、前端、DB、配置、编排变更。

**验证**：`pnpm -C servers/api lint && pnpm -C servers/api test` 全绿（含既有用例）。

### 步骤 3：API 集成测试增补用例（subagent，SKILL: z-test）

加载 `tests/api/AGENTS.md`。基于 `tests/api/src/live-events.test.ts` 既有 stub 上游：

1. stub 数据集增补 gift_v2 来源信封：仿 `:87-109` `gift(i, min)` 新增 `giftV2(i, min)` 构造器（`type: "gift_v2"`，payload 结构同步骤 1 定稿夹具），并入 `:131-139` `dataset()`（礼物条数相应增加，注意核对依赖固定条数/分页边界的既有断言）；`filterByTypes`（`:144-147`）无需改动（按 `e.type` 过滤，stub 收到 `gift_v2` type 参数即返回）；
2. 新增用例：
   - `?type=gift` 检索 → stub 收到 `type=gift&type=gift_v2`（`qs.getAll("type")`），响应 items 同时含 gift 与 gift_v2 来源事件且均为 `type: "gift"`、eventId 均 `gift:` 前缀；
   - 缺省全类型检索 → stub 收到的 type 列表含 `gift` 与 `gift_v2`；
   - `?type=danmaku` → stub 收到的 type 不含 `gift_v2`；
   - `?type=gift_v2` → 400（并入既有 400 用例模式，参照 `:394` 附近）；
   - SSE `?type=gift` → `lastSubscribeTypes` 含 `gift` 与 `gift_v2`，gift_v2 帧以 `type: "gift"` 推送（参照 `:653-666` 既有 SSE 用例模式）；
   - gift_v2 来源事件 `POST /read` 已读 → 检索出口 `read: true`（已读链路对 `gift:` 前缀 eventId 生效）；
3. **既有断言核对**：扩参后 stub 收到的 type 列表变化可能影响既有 `qs.getAll("type")` 断言（如 `:362` `?type=danmaku&type=super_chat` 不受影响；凡查询含 gift 的既有用例逐一核对并按新口径更新）；数据集条数变化影响的 `total`/分页断言同步更新；
4. e2e 无新增（无 UI 变更）。

**验证**：Aspire 编排下 `tests/api` 全量通过。

### 步骤 4：收尾与验收

1. **Spec 同步**（根 AGENTS.md 强制要求，同一 PR 内）：更新 `docs/engineering/spec/backend-live.md`（gift_v2 归一化与 `toUpstreamTypes` 扩参现态）；核对 `docs/product/spec/danmaku.md`——对外行为口径无变化则不改（PRD §1.3：用户无法感知事件来源）；PRD 与提案为时点文档，不改原文；
2. 更新 `servers/api/AGENTS.md` `:51` `/api/live-events` 段落：归一化识别五类信封（gift_v2 并入 gift 流）、路由层 `gift` → `["gift", "gift_v2"]` 扩参口径、eventId 前缀不变；
3. 核对提案 §10 验收标准与 PRD §1.3 成功标准逐条通过（含 `pnpm lint && pnpm test && pnpm build` 全绿）；
4. 推送 `feat/gift-v2` 并提 PR 至 `prd/gift-v2`，结束流程等待 review。

## 4. 依赖与风险

- **依赖**：上游已提供 gift_v2（同一内网服务、同一检索/订阅接口）；步骤 1 实测样本为字段映射的事实源；无新增依赖、无编排/基础设施变更；
- **并行协调**：单一开发分支 `feat/gift-v2`，步骤 1 → 2 → 3 串行（字段映射依赖样本，集成测试依赖后端就绪）；
- **风险**（对应提案 §5.2 与 §6.1）：
  - 上游尚未实际下发 gift_v2——以接口声明 schema 落夹具，PR 标注上线前真实流量回归（步骤 1.4）；
  - 同一礼物上游 gift/gift_v2 双发——以实测确认；若证实双发，按提案决策表在归一化出口按 eventId 去重（改动最小），补单测；
  - 扩参改变 `fetchRange`/`subscribe` 调用参数，破坏既有 `toHaveBeenCalledWith` 断言——按新口径更新（步骤 2.1 与 3.3），属断言同步而非逻辑变更；
  - stub 数据集条数变化影响既有分页/total 断言——步骤 3.3 逐一核对更新；
  - eventId 回退派生（`gift:{uid}:{giftId}:{timestamp}`）在翻页重取时不稳定——优先取 v2 等价连击标识，回退仅在样本证实无稳定 id 时启用（步骤 1.3 定稿）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-08-20-gift-v2-prd.md]]（v1.0）
- 技术提案：[[../proposals/2026-08-20-gift-v2-proposal.md]]（v1.0）
- 后端规范：[[../backend-rules.md]]
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 后端直播域 Spec（现态）：`docs/engineering/spec/backend-live.md`
- 既有契约：`contract/live-events.openapi.yaml`（本期不变）
