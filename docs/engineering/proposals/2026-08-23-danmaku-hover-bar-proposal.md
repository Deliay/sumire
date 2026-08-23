---
description: 弹幕看板「SC/上船 悬停胶囊栏」技术提案、SSE 实时 SC/上船按金额降序以宽胶囊置顶展示
type: Fleeting
---

# 弹幕看板「SC/上船 悬停胶囊栏」 - 技术提案

**功能名称**: 弹幕看板 SC/上船 悬停胶囊栏（Danmaku Hover Top Bar）
**关联 PRD**: `docs/product/requirements/draft/2026-08-23-danmaku-hover-bar-prd.md`
**技术提案版本**: v1.0
**创建日期**: 2026-08-23
**作者**: sumire workflow
**prd-branch**: `prd/danmaku-hover-bar`（需求总分支）
**feat-branch**: `feat/danmaku-hover-bar`（开发分支，实现时自需求总分支合入 main 后切出）

## 1. 概述

### 1.1 背景

弹幕看板现态（`docs/product/spec/danmaku.md` + `apps/bookstore/features/danmaku/`）：

- **信息流**：`FeedColumn`（栏容器，栏头 + 多 `FeedSection` 小节）。`DanmakuDashboard` 统一持数据并分发 SSE 实时事件（`handleStreamEvent`、`freshIds` 入场动画）。
- **SC 数据**：`LiveEvent.scColors = { backgroundStart, backgroundEnd, fontColor }`（上游 `payload.data.background_color_start/end`、`message_font_color`）、`price`（元）、`sender.face`（头像）。服务端 `normalize.ts` 的 `normalizeSuperChat` 透传三者，但**未透传悬停时长 `time`**。
- **上船数据**：`LiveEvent.guard = { level, name, count }`（level 3=舰长/2=提督/1=总督），`guard_buy` 上游无头像（`face: null`）。前端 `format.ts` 有 `guardLevelName`（level→船型名）与 `guardLevelTone(level)`（3→eye 蓝 / 2→flower 紫 / 1→crimson 红）。
- **SC/上船差异化配色**：SC 走 `SuperChatItem` 渐变（`scColors`）；上船走 `GuardItem` + `guardLevelTone` 船型色。

本期新增「SC/上船 悬停胶囊栏」：在包含 SC 或上船类型的栏内容区顶部提供一个约 48px 悬停带，把 SSE 实时到达的 SC/上船以宽胶囊按金额降序置顶展示，各胶囊按其悬停时长倒计时后移除。**点击胶囊可弹出浮层展示该 SC/上船事件的详细信息卡片**。纯前端展示增强 + 契约侧透传一个 SC 字段（`time`）。

### 1.2 目标

- 新增悬停胶囊栏组件，作用于含 SC/上船类型的栏内容区顶部；无有效胶囊时不占位；
- SSE 实时 SC/上船到达即生成胶囊，多胶囊按金额降序排列（金额相同新者优先）；
- SC 胶囊悬停时长 = 该事件 `time`（秒）；上船胶囊固定时长 舰长 60s / 提督 5min / 总督 1h；
- SC 胶囊用 `scColors` 渐变底色 + `fontColor` 文字色；上船胶囊用 `guardLevelTone` 船型强调色；
- 点击胶囊弹出浮层展示事件详情卡片（发送者头像、昵称、粉丝牌、事件类型、金额/价格、留言内容、发生时间等）；
- 倒计时到期胶囊移除；既有能力（虚拟化、SSE、已读、栏位配置、gift-min-price、hide-low-sc）零回归。

### 1.3 范围

- **做**：服务端 `normalizeSuperChat` 透传上游 `data.time` 为 `LiveEvent` 新可选字段 `time`（秒），契约 `contract/live-events.openapi.yaml` 与前端 `types.ts` 同步；新增悬停胶囊栏组件 `HoverTopBar.tsx` + `useHoverPills` 数据钩子；新增 `GiftCardDialog` 浮层组件；胶囊点击弹出浮层；`FeedColumn`/`DanmakuDashboard` 接线；单元测试。
- **不做**：改变信息流内容/已读/栏位配置；历史 SC 纳入悬停栏（仅 SSE 实时事件驱动）；悬停栏可开关/持久化配置；服务端改 SSE 推送逻辑；列定位到虚拟化未装载的行（虚拟化天然只渲染可视区，目标记录在已加载列表才可精确定位）；编排与基础设施变更。

> 说明：本节点仅产出需求文档与提案。代码与 spec 同步在后续 `feat/danmaku-hover-bar` 开发分支按 TDD 落地，本提案给出实现方案与验收口径。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph TD
    U[运营盯屏] --> DASH[DanmakuDashboard]
    DASH -->|SSE 实时事件分发| STREAM[useLiveEventStream]
    STREAM -->|super_chat/guard_buy| HOOK[useHoverPills 集合 + 倒计时]
    HOOK --> BAR[HoverTopBar 约48px 悬停胶囊栏]
    BAR --> SC[SC 胶囊 scColors 渐变 + 醒目留言 + 价格]
    BAR --> GB[上船胶囊 guardLevelTone 船型色 + 船型]
    U -->|点击胶囊| BAR
    BAR -->|eventId| DIALOG[GiftCardDialog 弹出礼物卡片浮层]
    DIALOG --> CARD[事件详情卡片]
    CONTRACT[契约暴露 SC time] --> HOOK
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js（App Router）+ React + TS strict | 改造集中在 `features/danmaku/` |
| 样式 | Tailwind v4（@theme token） | SC 渐变/船型色为事件数据色（内容色例外），容器用 token |
| 时钟 | 客户端 `setInterval` 单统一扫描 | 见实现点 3 |
| 测试 | Vitest + Testing Library | 悬停胶囊计时/排序/取色纯函数与组件 |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `servers/api/src/liveEvents/normalize.ts` | SC 透传 `time` | `normalizeSuperChat` 提取 `payload.data.time`（秒） |
| `contract/live-events.openapi.yaml` | 暴露 SC `time` | `LiveEvent.time?: integer`（仅 super_chat，秒） |
| `apps/bookstore/features/danmaku/types.ts` | 前端字段同步 | `LiveEvent` 增加可选 `time` |
| `apps/bookstore/features/danmaku/hoverTopBar.ts`（新增） | 纯函数 | `isHoverable`/`pillPrice`/`hoverDuration`/`pillKind`/`pillSort` |
| `apps/bookstore/features/danmaku/useHoverPills.ts`（新增） | 胶囊集合 + 计时 | 单一 interval 扫描过期，金额降序排列 |
| `apps/bookstore/features/danmaku/components/HoverTopBar.tsx`（新增） | 悬停胶囊栏 | 约 48px 容器；SC/上船胶囊渲染；无胶囊不占位；胶囊点击回调上抛 `eventId` |
| `apps/bookstore/features/danmaku/components/GiftCardDialog.tsx`（新增） | 礼物卡片浮层 | 模态对话框，展示 SC/上船事件详情卡片 |
| `apps/bookstore/features/danmaku/components/FeedColumn.tsx` | 挂载悬停栏 | 栏头之下、小节之上；胶囊点击触发浮层 |

## 3. API 设计

### 3.1 契约变更（仅新增可选字段）

`contract/live-events.openapi.yaml` 的 `LiveEvent` 新增可选字段透传 SC 悬停时长：

| 字段 | 位置 | 类型 | 说明 |
|------|------|------|------|
| `time` | `LiveEvent`（仅 super_chat 携带） | integer（秒） | SC 悬停时长：上游 `SUPER_CHAT_MESSAGE` payload 的 `data.time`（B 站标准字段，单位秒，如 60/120/180/300/3600 档） |

**实现路径**：服务端 `normalizeSuperChat` 在 `scColors`/`price` 之外，读取 `payload.data.time`（`asNumber`，须为正整数），存在则平铺透传；缺失不下发可选字段，前端回退默认。后端路由层无需改动（归一化后即随检索/SSE 出口）。其余 `/api/live-events/*` 端点语义、权限、分页、SSE 一律不变。

### 3.2 展示层垂直无接口

悬停胶囊栏不新增端点，数据全部来自既有 SSE 实时事件分发（`handleStreamEvent`）。

## 4. 数据模型

- **数据库**：无变更。
- **契约/前端类型**：`LiveEvent` 增加可选 `time`（仅 super_chat 携带）。
- **客户端内存**（非持久化）：`HoverPill = { eventId, kind: "sc"|"guard", price, arrivedAt, expiresAt, event }`；悬停胶囊**不落 localStorage**（时点展示，刷新即清，无需持久化）。

## 5. 技术实现方案

### 5.1 核心流程

```mermaid
sequenceDiagram
    participant STREAM as useLiveEventStream/SSE
    participant DASH as DanmakuDashboard
    participant HOOK as useHoverPills
    participant BAR as HoverTopBar
    participant DIALOG as GiftCardDialog
    STREAM->>DASH: handleStreamEvent(super_chat/guard_buy)
    DASH->>HOOK: add(event) 含 SC/上船类型的栏
    HOOK->>HOOK: 计算 expiresAt SC=time 秒 / 上船=等级固定时长
    HOOK-->>BAR: 胶囊集合（按金额降序）
    Note over HOOK: 单一 interval(500ms) 扫描 expiresAt<now 移除
    BAR->>DASH: onLocate(eventId)（点击胶囊）
    DASH->>DIALOG: 打开 GiftCardDialog 并传入事件数据
    DIALOG-->>BAR: 展示事件详情卡片，关闭后回到胶囊栏
    Note over HOOK: 到期移除，无胶囊时 BAR 隐藏不占位
```

### 5.2 关键实现点

#### 实现点 1: 服务端透传 SC `time`（normalize.ts + 契约 + types.ts）

- **描述**: `normalizeSuperChat` 读取 `payload.data.time`（秒）透传为 `LiveEvent.time`；契约与前端同步，缺失可选。

  ```ts
  const time = asNumber(data.time);
  // 返回对象带 ...(time !== undefined && time > 0 ? { time } : {})
  ```

  ```yaml
  # contract/live-events.openapi.yaml
  time:
    type: integer
    description: SC 悬停时长（秒，仅 super_chat；上游 data.time 标准字段，如 60/120/180/300/3600）；缺失由前端回退默认
  ```

- **技术细节**: SC `time` 是只读展示字段，无越权风险；仅 super_chat 携带。gift/guard 不新增字段（上船悬停时长由前端按 `guard.level` 固定映射，见实现点 3）。
- **风险点**: 上游若提供 `time` 为字符串需 `asNumber` 兼容；缺失下游前端回退默认。

#### 实现点 2: 悬停胶囊纯函数（hoverTopBar.ts）

- **描述**: 新增展示换算纯函数：

  ```ts
  export type PillKind = "sc" | "guard";
  export const SC_DEFAULT_SECONDS = 60;
  export function isHoverable(event: LiveEvent): boolean {
    return event.type === "super_chat" || event.type === "guard_buy";
  }
  export function pillPrice(event: LiveEvent): number {
    return typeof event.price === "number" ? event.price : 0;
  }
  /** SC=time（缺失/非法回退 60s）；上船=舰长60/提督300/总督3600，未知回退舰长档。 */
  export function hoverDuration(event: LiveEvent): number {
    if (event.type === "super_chat") {
      const t = typeof event.time === "number" && event.time > 0 ? event.time : SC_DEFAULT_SECONDS;
      return t;
    }
    const level = event.guard?.level;
    if (level === 1) return 3600; // 总督 1h
    if (level === 2) return 300;  // 提督 5min
    return 60;                    // 舰长 / 未知默认 60s
  }
  export function pillKind(event: LiveEvent): PillKind {
    return event.type === "super_chat" ? "sc" : "guard";
  }
  export function pillSort(a: HoverPill, b: HoverPill): number {
    if (a.price !== b.price) return b.price - a.price; // 金额降序
    return a.arrivedAt - b.arrivedAt;                  // 相同金额新者优先
  }
  ```

- **技术细节**: `time` 落位到前端类型 `LiveEvent.time?`（仅 super_chat）。排序谓词 `pillSort` 强调金额降序、金额相同新者优先，与 F1 口径一致。
- **风险点**: 计时基于 `expiresAt` 时间戳而非剩余秒数，避免 interval 漂移累积误差。

#### 实现点 3: 胶囊集合 + 倒计时（useHoverPills.ts）

- **描述**: `useHoverPills(types)` 维护当前有效胶囊集合（数组 + 单一 `setInterval(500ms)`）：

  - `add(event)`：`isHoverable` 且事件类型属于本栏 `types` 时，以 `eventId` 为 key 生成 `HoverPill`（`arrivedAt = Date.now()`、`expiresAt = arrivedAt + hoverDuration(event)*1000`）加入；同一 `eventId` 重复到达覆盖（刷新计时）；
  - 单一 interval 每次 tick 过滤 `expiresAt > Date.now()` 的胶囊并重排 `pillSort`；
  - 返回 `pills`（排序后数组）供 `HoverTopBar` 渲染；`types` 变化或卸载时清理 interval。

- **技术细节**: 单一 interval 统一扫描而非逐胶囊 timer（PRD §4.1）；胶囊量级小，`pillSort` 每 tick 重排 O(n log n) 可忽略。只认 SSE 实时到达，历史分页不注入悬停栏。
- **风险点**: 后台 tab 节流——用 `expiresAt` 时间戳判定，节流下到期即清，无需逐秒校正；刷新页面清空悬停胶囊属预期（不持久化）。

#### 实现点 4: 悬停胶囊栏组件（HoverTopBar.tsx）+ 接入（FeedColumn）

- **描述**: 新增 `HoverTopBar({ pills })` 组件：

  - 容器高约 48px，位于 `FeedColumn` 栏头之下、`FeedSection` 之上；
  - `pills.length === 0` 时渲染空（不占位）；
  - SC 胶囊：`background: linear-gradient(90deg, {scColors.backgroundStart}, {scColors.backgroundEnd})` + `color: scColors.fontColor`，内容 `Sender(compact)` + 「醒目留言」+ `formatPrice(price)`；
  - 上船胶囊：`guardLevelTone(level)` 的 `chip`/`text`/`item` token + 头像 + `guardLevelName ?? guard.name`；
  - 每个胶囊可点击（`cursor-pointer` + `role=button`/`aria-label`），点击调用 `onLocate(eventId)`；胶囊被点击（或当前处于定位命中）时给出一致的按压态；
  - `FeedColumn` 新增可选 `hoverPills?: HoverPill[]` + `onLocate(eventId)` 入参，在 `sections` 含 SC/上船类型时于内容区顶部渲染。

- **技术细节**: SC 语义「醒目留言」为固定四字文案，不随 `content` 变化；头像兜底复用 `Sender` 组件 compact 形态。胶囊用事件数据色（内容色例外，PRD §5.2）。点击回调只上抛 `eventId`，由 `DanmakuDashboard` 触发 `GiftCardDialog` 打开。
- **风险点**: ① SC 渐变按 `scColors` 缺失回退中性底色（沿用 `SuperChatItem` 缺省）；② 悬停栏为栏头定高区，不与 `FeedSection` 虚拟化滚动争用，需以 flex 布局保证信息流仍 `min-h-0 flex-1` 可滚动。

#### 实现点 5: 点击胶囊弹出礼物卡片浮层（GiftCardDialog）

- **描述**: 新增 `GiftCardDialog` 组件，点击胶囊后弹出浮层展示该 SC/上船事件的详细信息卡片：

  - **浮层展示**：`GiftCardDialog` 为模态对话框，居中展示，半透明遮罩背景，圆角边框，阴影效果；
  - **卡片内容**：展示发送者头像、昵称、粉丝牌、事件类型（SC/上船）、金额/价格、留言内容（如有）、发生时间等完整信息；
  - **交互**：浮层可通过点击关闭按钮、点击遮罩层或按 Esc 键关闭；
  - **接线**：`DanmakuDashboard` 的 `handleLocate(eventId)` 改为触发 `GiftCardDialog` 打开，传入对应的事件数据。

- **技术细节**: `GiftCardDialog` 使用 React Portal 渲染到 body，避免被父容器 overflow 裁剪；SC 卡片使用 `scColors` 渐变配色，上船卡片使用 `guardLevelTone` 船型强调色；浮层状态由 `DanmakuDashboard` 管理（`selectedEvent` state），关闭时重置为 null。
- **风险点**: ① 移动端（<640px）浮层需要适配全屏展示；② 浮层打开时应阻止背景滚动（`overflow: hidden` on body）；③ 浮层关闭后焦点应回到触发胶囊（无障碍访问）。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 悬停栏作用范围 | 含 SC/上船类型的栏 | 仅弹幕栏 | B（评审决定） | 评审决定悬停栏仅挂载于勾选弹幕的栏，聚焦弹幕场景；胶囊集合仍为栏无关共用 |
| SC 悬停时长来源 | 契约透传 `data.time` | 前端本地固定档位 | A | 需求明确 SC 用 `time` 属性（秒）；透传与上游一致，各档时长无需前端维护 |
| SC `time` 缺失处理 | 前端回退默认 60s | 不展示胶囊 | A | 保守展示，错失即时答谢代价高于误显 |
| 数据来源 | 仅 SSE 实时事件 | 实时 + 历史首屏 | A | 悬停栏是「当下生效」提醒，历史 SC 无时效意义；避免分页注入复杂度 |
| 计时实现 | 单一 interval 扫描 | 逐胶囊 setTimeout | A | 胶囊多时有定时器堆积风险；统一扫描更稳（PRD §4.1） |
| 排列顺序 | 金额降序 | 到达时间倒序 | A | 需求「按礼物金额排序」；金额相同新者优先 |
| 持久化 | 不落 localStorage | 持久化 | A | 悬停胶囊为时点展示，刷新即清符合「当下有效」语义，无持久化价值 |
| 点击胶囊交互 | 弹出浮层展示礼物卡片 | 滚动定位并闪光 | A | 弹出浮层展示事件详情卡片，提供更丰富的信息展示，符合用户需求 |
| 浮层设计 | 模态对话框 + 半透明遮罩 | 非模态浮层 | A | 模态对话框提供更好的聚焦体验，半透明遮罩保持上下文可见性 |
| 多类型混排栏定位路由 | 按 `eventId` 的类型路由到含该类型的 `FeedSection` | 仅当前小节/仅首个小节 | A | 目标在任一含该类型的节内都应可定位；F3/F4 覆盖 SC 与上船所在节 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | 弹幕看板既有实现（`FeedColumn`/`FeedSection`/`useLiveEventStream`/`DanmakuDashboard`） | 改造基底 |
| 依赖 | SC `scColors`、`price`；guard `level` | 胶囊渲染取色，上船时长由 `level` 映射 |
| 依赖 | 上游 `SUPER_CHAT_MESSAGE # payload.data.time` | 契约新增字段的唯一来源 |
| 约束 | Tailwind token 色、禁硬编码色值（事件数据色例外） | `frontend-rules.md` |
| 约束 | 静态导出（GitHub Pages） | 全部客户端行为；悬停胶囊不持久化，无首帧闪烁问题 |
| 约束 | 动效克制 ≤200ms + `prefers-reduced-motion` 降级 | `frontend-rules.md`、`03-backdoor-design.md` |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/danmaku-hover-bar` 需求总分支 |

## 7. 项目结构

```
servers/api/src/liveEvents/normalize.ts       # 修改：normalizeSuperChat 透传 data.time
contract/live-events.openapi.yaml             # 修改：LiveEvent 增可选 time
apps/bookstore/features/danmaku/types.ts      # 修改：LiveEvent 增可选 time
apps/bookstore/features/danmaku/hoverTopBar.ts            # 新增：纯函数
apps/bookstore/features/danmaku/useHoverPills.ts          # 新增：胶囊集合 + 倒计时
apps/bookstore/features/danmaku/components/HoverTopBar.tsx # 新增：悬停胶囊栏
apps/bookstore/features/danmaku/components/GiftCardDialog.tsx # 新增：礼物卡片浮层
apps/bookstore/features/danmaku/components/FeedColumn.tsx  # 修改：挂载悬停栏 + onLocate 接线
apps/bookstore/features/danmaku/components/DanmakuDashboard.tsx # 修改：handleLocate 触发 GiftCardDialog
apps/bookstore/tests/unit/
    ├── danmaku-hover-top-bar.test.ts         # 新增：纯函数
    ├── danmaku-use-hover-pills.test.tsx      # 新增：胶囊 add/到期/排序/interval
    ├── danmaku-hover-top-bar.test.tsx        # 新增（或并入）：组件渲染/空状态/配色/点击回调
    └── danmaku-gift-card-dialog.test.tsx    # 新增：GiftCardDialog 浮层渲染/关闭/事件数据展示
servers/api/tests/liveEventsNormalize.test.ts # 更新：SC 透传 time 断言
```

编排（`infra/aspire`）、服务端路由层、数据库零变更。

## 8. 测试策略

### 8.1 测试覆盖要求

- 单元测试（后端）：
  - `liveEventsNormalize.test.ts`：super_chat 携带 `data.time` → 透传 `time`；缺 `data.time` → 不携带可选字段。
- 单元测试（前端）：
  - `hoverTopBar.ts`：`isHoverable`（仅 super_chat/guard_buy）；`pillPrice`（缺失→0）；`hoverDuration`（SC=time / 缺省 60s / 舰长60/提督300/总督3600/未知60）；`pillKind`；`pillSort`（金额降序、同额新者优先）；
  - `useHoverPills`：add 生成 `expiresAt` 正确；interval 到期移除非到期保留；重复 `eventId` 覆盖刷新计时；排序输出；
  - `HoverTopBar`：无 pill 不占位；SC 胶囊含「醒目留言」+ 价格 + 渐变样式；上船胶囊含船型 + 配色；`scColors` 缺失回退；点击胶囊触发 `onLocate(eventId)`；
  - `FeedSection` 定位 + 闪光：`locate(eventId)` 命中行 `scrollToIndex`（对齐居中）并加入 `flashIds`，行渲染闪光类，计时后复位移除；**未命中（分页未加载）时滚动列表、触底 `onLoadMore` 逼近并再次定位到目标，到底无更多时停止并落下目标深度（不无限循环）**；重复定位可重新闪光；多类型混排栏路由到包含目标类型的节。
- API/e2e 无契约破坏：契约仅增加可选字段，`live-events` 既有测试保持绿；e2e 既有断言通常不涉及悬停栏（空时不占位）。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试（后端） | Vitest | normalize SC `time` 透传 |
| 单元测试（前端） | Vitest + Testing Library | 纯函数、胶囊计时/排序、组件渲染 |

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地联调 | Aspire 编排（既有四资源） | `aspire start`，无配置变更 |
| GitHub Pages 生产 | 纯静态 | 无新增配置项 |

### 9.2 配置管理

无新增配置项。

## 10. 验收标准

- [ ] 技术方案评审通过
- [ ] 契约 `live-events` 增 SC `time` 可选字段，normalize 透传、前端类型同步，缺失兼容
- [ ] 含 SC/上船类型的栏内容区顶部出现约 48px 悬停栏；无胶囊不占位
- [ ] SSE 实时 SC/上船到达即生成胶囊，多胶囊按金额降序排列（同额新者优先）
- [ ] SC 胶囊渐变底色 + 醒目留言 + 价格，悬停时长 = `time` 秒；上船胶囊船型强调色 + 船型，悬停时长 舰长60/提督300/总督3600 秒
- [ ] 胶囊到期自动移除、全部清零悬停栏不占位；虚拟化/已读/SSE/栏位配置等既有能力零回归
- [ ] 点击任一 SC/上船胶囊，弹出 GiftCardDialog 浮层展示事件详情卡片（发送者头像、昵称、粉丝牌、事件类型、金额/价格、留言内容、发生时间等）
- [ ] 单元测试全绿，`pnpm lint && pnpm test && pnpm build` 全绿

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-08-23-danmaku-hover-bar-prd.md`
- 产品 Spec（现态）：`docs/product/spec/danmaku.md`
- 弹幕看板 v3 提案：`docs/engineering/proposals/2026-08-22-danmaku-board-v3-proposal.md`
- 开发规范：`docs/engineering/frontend-rules.md`、`docs/engineering/backend-rules.md`
