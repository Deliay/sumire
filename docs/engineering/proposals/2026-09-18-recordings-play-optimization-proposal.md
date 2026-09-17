---
description: 录播播放优化技术提案——纯前端方案：player.ts 的 play() 增加 autoplay 选项、FlvPlayerPanel 默认暂停并在视频容器内叠加播放按钮 overlay（容器点击复用 togglePlay 通路）；回放页容器留白收窄至 px-1 lg:px-2、视频列 lg:w-3/4→lg:w-4/5、事件列去除固定 70vh 改为 flex stretch 与播放器等高，零新增依赖、零 API 变更
type: Fleeting
---

# 录播播放优化 - 技术提案

**功能名称**: 录播播放优化（Recording Playback Optimization）
**关联 PRD**: `docs/product/requirements/draft/2026-09-18-recordings-play-optimization-prd.md`
**技术提案版本**: v1.0
**创建日期**: 2026-09-18
**作者**: sumire workflow
**prd-branch**: `prd/recordings-play-optimization`（需求总分支）
**feat-branch**: `feat/recordings-play-optimization`（开发分支，实现时自需求总分支合入 main 后切出）

## 1. 概述

### 1.1 背景

回放页 `/recordings/replay` 播放器现态两处与本需求直接相关：

- **自动播放**：`features/recordings/player.ts:152-175` 的 `play()` 内建 `player.load(); void player.play()`（`player.ts:170-171`），`FlvPlayerPanel` 在 MSE 探测通过后挂载即 `start()`（`FlvPlayerPanel.tsx:244-248`）。`<video>` 无 `muted`，带声音的自动播放正是浏览器自动播放策略拦截的场景——首次交互前播放被拒，用户看到卡住/失败的画面；
- **布局**：回放页容器 `mx-auto max-w-7xl px-2.5 py-24 lg:px-5`（`replay/ReplayApp.tsx:92`）；舞台内桌面端视频列 `lg:w-3/4`（`replay/ReplayStage.tsx:140`）、事件列 `lg:h-[70vh] lg:w-1/4`（`ReplayStage.tsx:134-135`）。事件列固定 70vh 与播放器（`aspect-video` 推导 + 流内控制条，约 600px@1280px 容器）不齐高，视频宽度占比也有提升空间。

可复用的既有机制：

- 播放/暂停通路：`FlvPlayerPanel.tsx:324-337` 的 `togglePlay()`（`owns` 归属判定 + `pausePlayer()/resumePlayer()` + 本地 `paused` state），画面点击可直接复用；
- overlay 插槽：视频容器 `relative aspect-video w-full overflow-hidden rounded-lg bg-black`（`FlvPlayerPanel.tsx:493`）内已渲染 `{overlay}`（`:508`，当前为 `DanmakuOverlay`，`pointer-events-none`），点击事件天然落在容器上；
- `ReplayStage` 的 `playing` state（`ReplayStage.tsx:27`）已驱动弹幕浮层 `setPaused`，初始暂停态下浮层自然不滚动，无需额外联动。

### 1.2 目标

- F1：播放器默认暂停态（流加载、画面就绪、不播放）；视频容器内叠加播放按钮 overlay，暂停时展示；点击画面（含 overlay、含弹幕浮层区域）经 `togglePlay` 播放/暂停；
- F2：回放页容器左右留白收窄（`px-2.5 lg:px-5` → `px-1 lg:px-2`）；视频列 `lg:w-3/4` → `lg:w-4/5`（事件列相应 `lg:w-1/5`）；事件列去除固定 `lg:h-[70vh]`，改为 flex 行内 stretch 与播放器列等高。

### 1.3 范围

- **做**：`player.ts` autoplay 选项、`FlvPlayerPanel` 默认暂停 + overlay + 容器点击、`ReplayApp`/`ReplayStage` 布局类调整、单测/e2e 更新；实现 PR 内同步 spec（含 `site-pages.md:71` 布局描述与代码既有脱节的一并修正）。
- **不做**：录播列表页、弹幕浮层渲染逻辑、事件取数/窗口调度、seek、双全屏状态机本体、`LiveAudioButton`（听直播为用户点击触发，保持自动播放）、`servers/api` / 契约 / 编排资源；新增依赖。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph LR
    subgraph 视频容器（FlvPlayerPanel）
        VIDEO[video 画面<br/>aspect-video]
        DANMAKU[DanmakuOverlay<br/>pointer-events-none]
        OVERLAY[播放按钮 overlay<br/>paused 时展示]
        CONTROLS[控制条<br/>播放/暂停按钮]
    end
    PANEL[FlvPlayerPanel<br/>paused state / togglePlay]
    PLAYER[player.ts 单例<br/>play url video autoplay]
    STAGE[ReplayStage<br/>lg:w-4/5 视频列 + lg:w-1/5 事件列]
    APP[ReplayApp<br/>max-w-7xl px-1 lg:px-2]
    TIMELINE[EventTimeline<br/>stretch 等高 列内滚动]

    VIDEO -->|容器 onClick| PANEL
    OVERLAY -->|冒泡至容器| PANEL
    DANMAKU -.->|不吞事件| VIDEO
    CONTROLS -->|stopPropagation| PANEL
    PANEL -->|autoplay=false| PLAYER
    APP --> STAGE
    STAGE --> TIMELINE
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js 16 + React 19（既有） | 仅客户端组件内交互与布局类变更 |
| 播放器 | mpegts.js 1.8.2（既有 patch） | `play()` 增加选项，不触碰 patch |
| 图标 | `lucide-react`（既有依赖） | `Play` 图标，无新增依赖 |
| 样式 | Tailwind v4 + token 色（既有） | overlay 用 `--color-flower` 等 token，禁硬编码 |
| 测试 | Vitest + Testing Library；Playwright | 更新既有 recordings 用例 |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `apps/bookstore/features/recordings/player.ts` | `play()` 增加 `autoplay` 选项（默认 `true`） | `false` 时跳过 `player.play()`，归属订阅照常 |
| `apps/bookstore/features/recordings/replay/FlvPlayerPanel.tsx` | 默认暂停 + overlay + 容器点击 | `paused` 初始 true、overlay 渲染、容器 onClick 复用 `togglePlay`、控制条 stopPropagation |
| `apps/bookstore/features/recordings/replay/ReplayApp.tsx` | 页面容器留白收窄 | 正常/加载/错误三态容器口径同步 |
| `apps/bookstore/features/recordings/replay/ReplayStage.tsx` | 列宽比与事件列等高 | `lg:w-4/5` / `lg:w-1/5`、去除 `lg:h-[70vh]` 改 stretch |
| `apps/bookstore/tests/unit/flv-player-panel.test.tsx` 等 | 用例更新 + 新增 | 初始暂停态、overlay、容器点击 |
| `tests/e2e/src/bookstore/recordings-replay.spec.ts` | e2e 更新 | 布局用例回归、初始暂停断言 |

## 3. API 设计

无本站 API 变更，无契约变更。回放页消费的公开端点 `GET /api/live-events/replay` 与录播文件 URL 构造均不变。

## 4. 数据模型

无持久化变更。组件内 state 变化仅 `FlvPlayerPanel` 的 `paused` 初始值由 `false` 改为 `true`（就绪即暂停），无新增状态。

## 5. 技术实现方案

### 5.1 核心流程

- **F1 默认暂停**：`player.ts` 的 `play(url, videoEl, { isLive, onError, fileSize, autoplay = true })` 增加 `autoplay` 选项；`autoplay === false` 时执行 `player.load()` 但跳过 `void player.play()`。`FlvPlayerPanel.start()`（`:164-181`）对录播回放传 `autoplay: false`，`paused` state 初始化为 `true`；`LiveAudioButton` 不传该选项（听直播为用户手势触发，保持自动播放）。
- **F1 overlay**：`paused && !failed && supported === true` 时在视频容器内、`{overlay}` 之后渲染一层居中播放按钮：`absolute inset-0 grid place-items-center pointer-events-none`，内部为半透明深色圆形底板（`bg-night/60` 类 token 色）+ `lucide-react` `Play` 图标（`text-flower`）；整层 `pointer-events-none`，仅作视觉提示。
- **F1 容器点击**：视频容器 div（`:493`）加 `onClick={togglePlay}`；overlay 与 `DanmakuOverlay` 均 `pointer-events-none`，点击冒泡至容器；控制条（非全屏时在容器外流内、全屏时 `data-testid="fullscreen-controls"` 悬浮于容器内）加 `onClick` stopPropagation，避免进度条/音量/全屏按钮触发画面切换。
- **F2 留白**：`ReplayApp.tsx:92` 容器类 `px-2.5 lg:px-5` → `px-1 lg:px-2`；加载态（`:74`）与空态（`:18`）容器同口径同步。
- **F2 列宽与等高**：`ReplayStage.tsx:140` 视频列 `lg:w-3/4` → `lg:w-4/5`；`:134-135` 事件列 `lg:h-[70vh] lg:w-1/4` → `lg:w-1/5`，去除固定高度——flex 行默认 `align-items: stretch` 使事件列与播放器列（画面 + 流内控制条）自然等高，`EventTimeline` 内部 `min-h-0 flex-1 overflow-y-auto` 滚动容器既有不变；web 全屏分支的 `timelineWrapperClass` 逻辑保持。

### 5.2 关键实现点

#### 实现点 1: player.ts autoplay 选项

- `PlayOptions` 增加 `autoplay?: boolean`，缺省 `true`（现状等价）；为 `false` 时 `player.load()` 后不调用 `player.play()`；
- 代次号丢弃过期实例、错误回调、缓冲配置等既有逻辑不动；
- **风险点**：`play()` 内 `void player.play()` 的 Promise 拒绝（自动播放拦截）现态未被捕获——传 `autoplay: false` 后该路径不再触发，回放页天然规避；`LiveAudioButton` 仍走自动播放但由用户手势触发，不受影响。

#### 实现点 2: FlvPlayerPanel 默认暂停与容器点击

- `paused` useState 初始值 `false` → `true`；`start()` 中 `play(url, video, { isLive: false, autoplay: false, ... })`；
- `togglePlay` 现有三分支（`!owns` 重 `start()` / paused 恢复 / 播放中暂停）对初始暂停态天然兼容：`owns=true`（归属已建立）且 `paused=true` → `resumePlayer()`；无需为 overlay 新增通路；
- 容器 `onClick={togglePlay}`；控制条容器与全屏控制条悬浮层 `onClick={(e) => e.stopPropagation()}`；进度条/音量等子控件无需逐个处理（统一由控制条容器拦截）；
- overlay 展示条件 `paused && !failed && supported === true`，与 MSE 降级（`supported === false`）、失败态（`failed`）互斥；`aria-hidden="true"`（纯视觉，可达性由控制条按钮承担）；
- **风险点 1**：web 全屏下控制条转为悬浮（不占流内高度），事件列等高以「画面 + 流内控制条」为准的口径在全屏下不适用——全屏分支本就有独立布局，本期不改；
- **风险点 2**：视频元数据未就绪时画面为黑底 + overlay，属预期（用户点击后才解码播放）；`ReplayStage` 的 `playing=false` 使弹幕浮层静止，与初始暂停态一致。

#### 实现点 3: 布局类调整与等高验证

- 三处容器、两处列宽、一处固定高度共 6 个类名级改动，不动任何结构；
- 事件列去固定高度后，`EventTimeline` 虚拟化滚动容器的高度由 stretch 结果提供——实现期需单测断言列高跟随播放器列，并在 e2e 目视/截图验证桌面端等高与列内滚动；
- **风险点**：事件列内容极少时 stretch 仍保证与播放器等高（列背景/边框完整），条目不拉伸——由 `EventTimeline` 既有顶对齐布局保证，无需改动；
- 移动端（`<lg`）不含任何 `lg:` 前缀类的变化，行为与现态一致。

#### 实现点 4: 既有用例的最小更新

- `flv-player-panel.test.tsx`：`"暂停按钮切换播放/暂停"`（`:122`）等断言初始为「暂停」按钮的用例改为初始「播放」+ overlay 存在；新增用例：初始暂停态（`paused=true`、overlay 渲染、`player.play()` 未被调用）、容器点击触发 `resumePlayer`、overlay 点击冒泡等效、控制条点击不冒泡、播放态 overlay 隐藏；
- `replay-stage.test.tsx`：列宽类断言更新（`lg:w-4/5`/`lg:w-1/5`）、事件列无 `lg:h-[70vh]`；
- `recordings-player.test.ts`：新增 `autoplay: false` 时 `player.play()` 未调用的用例；
- `recordings-replay.spec.ts`（e2e）：舞台布局用例（`:204-244`）回归；新增初始暂停态断言（控制条按钮 aria-label「播放」）；mock FLV 流为空 body 播不起来的现状不变，不断言真实播放；
- 属接口/现态变更的正常测试更新，不改无关用例。

#### 实现点 5: Spec 同步（实现 PR 内）

- `docs/product/spec/site-pages.md` 回放页节：补充「默认暂停 + 播放 overlay + 画面点击播放/暂停」现态；布局行（`:71`）更新为 4/5 + 1/5 等高，并顺带修正其与代码的既有脱节（2/3 宽、已移除的操作区描述）；
- `docs/engineering/spec/frontend-bookstore.md` 录播节：`player.ts` 的 `autoplay` 选项、`FlvPlayerPanel` overlay 与容器点击、回放页留白新口径（`:74`）；
- 根 `AGENTS.md` 无需变更（无结构与契约变更）。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 默认暂停实现 | `play()` 加 `autoplay` 选项，回放传 `false` | start 后立即 `pausePlayer()` | A | 后播放再暂停存在出声窗口与竞态；不调用 `play()` 语义最干净，且 `LiveAudioButton` 默认行为零影响 |
| 画面点击通路 | 容器 `onClick` 复用 `togglePlay` | overlay 按钮独立 onClick | A | `togglePlay` 三分支已覆盖初始暂停态，双通路必然状态分叉；overlay 设为 `pointer-events-none` 纯视觉，点击统一冒泡至容器 |
| overlay 形态 | 整层 `pointer-events-none` 视觉提示 | 独立可点击按钮元素 | A | 与「点击画面任意区域」语义一致，无嵌套点击目标的命中歧义；可达性由控制条按钮承担 |
| 事件列等高 | 去固定高度，flex stretch | JS 测量播放器高度回写 | A | flex 行默认 stretch 天然等高，零 JS；测量方案引入 ResizeObserver 与闪烁风险，过度设计 |
| 播放器增宽幅度 | `lg:w-3/4` → `lg:w-4/5` | 增大容器 `max-w` | A | PRD 要求「稍微增大」，列宽比调整幅度可控且事件列保留 1/5 可读宽度；容器已 `max-w-7xl`，继续放大破坏全站版心一致性 |
| 留白收窄幅度 | `px-1 lg:px-2` | `px-0` | A | 保留最小可用留白，内容不触碰视口边缘 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | 既有 `togglePlay`/`owns`/`paused` 机制 | `FlvPlayerPanel` 现态，通路不变更 |
| 依赖 | `lucide-react`、token 色、`EventTimeline` 滚动容器 | 既有，无新增依赖 |
| 约束 | TDD；`pnpm lint && pnpm test` 全绿 | 先测试后实现 |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/recordings-play-optimization` → 合入 main 后切 `feat/recordings-play-optimization` |
| 约束 | 无在途并行需求触碰回放页 | 录播系列前序需求（seek/fullscreen、replay-danmaku）均已合入 main |

## 7. 项目结构

```
apps/bookstore/
├── features/recordings/
│   ├── player.ts                       # 改：play() 增加 autoplay 选项
│   └── replay/
│       ├── FlvPlayerPanel.tsx          # 改：默认暂停 + overlay + 容器点击
│       ├── ReplayApp.tsx               # 改：三态容器留白 px-1 lg:px-2
│       └── ReplayStage.tsx             # 改：lg:w-4/5 / lg:w-1/5，事件列去固定高度
├── tests/unit/
│   ├── flv-player-panel.test.tsx       # 改：初始暂停态 + overlay/点击用例
│   ├── replay-stage.test.tsx           # 改：列宽与等高类断言
│   └── recordings-player.test.ts       # 改：autoplay 选项用例
tests/e2e/src/bookstore/recordings-replay.spec.ts  # 改：布局回归 + 初始暂停断言
docs/product/spec/site-pages.md                  # 实现 PR 内同步（回放页节，含既有脱节修正）
docs/engineering/spec/frontend-bookstore.md      # 实现 PR 内同步（录播节）
```

## 8. 测试策略

### 8.1 测试覆盖要求

- **前端单测（Vitest）**：`play()` 在 `autoplay: false` 时不调用 `player.play()`、归属订阅照常；`FlvPlayerPanel` 初始 `paused=true` + overlay 渲染 + 控制条按钮 aria-label「播放」；容器点击调用 `resumePlayer` 且 overlay 隐藏；播放态点击暂停 overlay 重现；控制条区域点击不触发容器切换；MSE 不支持/失败态不渲染 overlay；`ReplayStage` 列宽类与事件列无固定高度断言。
- **e2e（Playwright）**：回放页初始为暂停态（按钮 aria-label「播放」）；桌面端舞台布局（视频列/事件列同屏可命中，既有 `:204-244` 用例）回归；web 全屏布局零回归。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library | autoplay 选项、overlay、容器点击、布局类 |
| API 测试 | 不新增 | 无本站 API 变更（纯前端功能） |
| e2e | Playwright | 初始暂停态、舞台布局、全屏回归（mock 上游） |

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地联调 | 既有 Aspire 编排 | 无新增编排资源 |
| 生产 | 既有 bookstore SSG 发布 | 无新环境变量与流水线变更 |

### 9.2 配置管理

无新增配置。

## 10. 验收标准

- [ ] 技术方案评审通过
- [ ] 播放器满足 PRD F1 全部验收标准（默认暂停、overlay、画面点击、状态同步、异常态互斥）
- [ ] 布局满足 PRD F2 全部验收标准（留白收窄、事件列等高、播放器占比增大、移动端零回归）
- [ ] 既有回放页行为（漂浮弹幕、事件列表跟随/seek、双全屏、进度条 seek、MSE 降级）零回归
- [ ] `pnpm lint && pnpm test` 全绿；e2e 回放 spec 通过
- [ ] Spec 同步：`site-pages.md`、`frontend-bookstore.md`

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-09-18-recordings-play-optimization-prd.md`
- 站点页面 Spec（现态）：`docs/product/spec/site-pages.md`
- 前端 Spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 开发规范：`docs/engineering/frontend-rules.md`
- 页面设计：`docs/design/02-page-design.md`
- 录播回放弹幕提案（前序）：`docs/engineering/proposals/2026-09-17-recordings-replay-danmaku-proposal.md`
