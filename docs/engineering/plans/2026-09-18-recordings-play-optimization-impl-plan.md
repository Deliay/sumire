---
description: 录播播放优化实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/recordings-play-optimization，唯一开发分支 feat/recordings-play-optimization。纯前端变更：player.ts 的 play() 增加 autoplay 选项（TDD）→ FlvPlayerPanel 默认暂停 + 播放按钮 overlay + 容器点击复用 togglePlay（TDD）→ ReplayApp/ReplayStage 布局类调整（留白 px-1 lg:px-2、视频列 lg:w-4/5、事件列去 70vh 改 stretch 等高，TDD）→ e2e 更新 → 手工验证 + spec 同步收尾。零新增依赖、零 API/契约变更。
type: Permanent
---

# 录播播放优化实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-18-recordings-play-optimization-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-18-recordings-play-optimization-proposal.md]]（v1.0）
**需求总分支**: `prd/recordings-play-optimization`（需求总 PR：<https://github.com/Deliay/sumire/pull/146>）
**开发分支**: `feat/recordings-play-optimization`（自需求总分支切出，**唯一开发分支**，实现/单测/e2e/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-18）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD（每个功能步骤先补失败用例再实现）。变更面仅 `apps/bookstore` 前端（4 个源码文件 + 3 个单测文件 + 1 个 e2e spec）与两份 spec 文档；无契约/后端/编排变更、无新增依赖。

> **分支口径说明**：提案头部「自需求总分支合入 main 后切出」与既有迭代口径不一致。上一期（2026-09-17 录播回放弹幕）实际执行顺序为 feat PR 回合需求总分支。本方案沿用既有迭代口径：自 `prd/recordings-play-optimization` 切出 feat 分支，完成后 PR 回合需求总分支。

**前提事实**（已在需求总分支 `prd/recordings-play-optimization` 核对代码现态，commit 573f686）：

- player 现态：`apps/bookstore/features/recordings/player.ts` `PlayOptions`（`:39`，`isLive` 必填 `:40`），`play(url, videoEl, options)`（`:152`）内建 `player.load(); void player.play()`（`:170-171`）；导出 `pausePlayer`/`resumePlayer`/`destroyPlayer`/`subscribePlayer`/`getPlayingUrl` 归属订阅机制。`LiveAudioButton`（听直播）走同一 `play()`，为用户手势触发，本期不传新选项、行为不变。
- 面板现态：`features/recordings/replay/FlvPlayerPanel.tsx`——`paused` state 初始 `false`（`:105`），`playing = owns && !paused`（`:129`）；`start()`（`:164-182`）内 `setPaused(false)` + `play(url, video, { isLive: false, fileSize, onError })`（`:173-180`）；`togglePlay()`（`:324-337`）三分支（`!owns` 重 `start()` / paused 恢复 / 播放中暂停），控制条播放按钮复用它（`:408`）；视频容器 `relative aspect-video w-full overflow-hidden rounded-lg bg-black`（`:492-493`），`{overlay}` 渲染于 `:508`（`DanmakuOverlay`，`pointer-events-none`）；控制条为 fragment `controls`（`:390`），非全屏渲染于容器外 `{mode === "none" && <div className="flex flex-col gap-2">{controls}</div>}`（约 `:530`），全屏时悬浮于容器内 `data-testid="fullscreen-controls"`（约 `:511`，已带显隐/悬停逻辑）。
- 布局现态：`ReplayApp.tsx` 三处容器同口径 `max-w-7xl px-2.5 py-24 lg:px-5`——空态 `:18`、加载态 `:74`、正常态 `:92`；`ReplayStage.tsx` 弹性行 `flex min-h-0 flex-1 flex-col gap-4 lg:flex-row`（`:139`），视频列 `lg:w-3/4`（`:140`），事件列 `timelineWrapperClass`（`:134-135`）非全屏分支 `flex min-h-0 flex-col lg:h-[70vh] lg:w-1/4`、web 全屏分支 `flex min-h-0 flex-col lg:w-1/4`；`playing` state（`:27`）已驱动 `DanmakuOverlay` 的 `setPaused`，初始暂停态下浮层自然静止，无需额外联动。
- 测试现态：`tests/unit/flv-player-panel.test.tsx`（`:122`「暂停按钮切换播放/暂停」断言初始为「暂停」按钮、`:145` MSE 降级、`:153` 下载入口）；`tests/unit/replay-stage.test.tsx`（视频能力零回归 `:78`、双全屏 `:92`、MSE 降级 `:172`）；`tests/unit/recordings-player.test.ts`（`play 缓冲封顶` describe `:110`）；e2e `tests/e2e/src/bookstore/recordings-replay.spec.ts`（三要素 `:147`、全屏 `:204`、错误态 `:246` 等 8 条用例，mock FLV 流为空 body 播不起来，不断言真实播放）。
- Spec 同步位置：`docs/product/spec/site-pages.md` 回放页节（「布局」行约 `:71` 现写「桌面端左视频（约 2/3 宽）」与代码 `lg:w-3/4` 既有脱节、且仍含已移除的「操作区」描述，本期一并修正）；`docs/engineering/spec/frontend-bookstore.md` 录播节（`FlvPlayerPanel` 描述 `:64`、留白口径 `:74`）；`apps/bookstore/AGENTS.md` 回放页约定节（`:100` `ReplayApp` 留白描述、`:101` `FlvPlayerPanel` 行为描述需补默认暂停/overlay/画面点击口径）。

整体顺序（纯前端单子项目，串行执行即可，无需并行委托）：
**切开发分支 → player.ts autoplay 选项（TDD）→ FlvPlayerPanel 默认暂停 + overlay + 容器点击（TDD）→ 布局类调整（TDD）→ e2e → 手工验证 + spec 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 播放启动 | `play()` 内建 `player.play()`，回放页挂载即带声音自动播放，首交互前被浏览器拦截 | `PlayOptions` 增加 `autoplay?: boolean`（缺省 `true`）；回放传 `false`：仅 `load()` 不 `play()`，画面就绪保持暂停 |
| 初始状态 | `paused` 初始 `false`，控制条初始显示「暂停」 | `paused` 初始 `true`，控制条初始显示「播放」，与真实状态一致 |
| 画面交互 | 视频画面不可点击，播放/暂停仅控制条小按钮 | 暂停时画面中央播放按钮 overlay（纯视觉 `pointer-events-none`）；视频容器 `onClick={togglePlay}`，点击画面任意区域（含弹幕浮层）播放/暂停 |
| 页面留白 | 三态容器 `px-2.5 py-24 lg:px-5` | `px-1 lg:px-2`，三态同口径 |
| 列宽比 | 视频 `lg:w-3/4` / 事件列 `lg:w-1/4` | 视频 `lg:w-4/5` / 事件列 `lg:w-1/5` |
| 事件列高度 | 固定 `lg:h-[70vh]`，与播放器不齐高 | 去固定高度，flex stretch 与播放器列（画面 + 流内控制条）等高，列内滚动沿用既有虚拟化容器 |
| 测试 | 单测断言初始「暂停」按钮、e2e 无初始暂停断言 | 单测/e2e 更新为初始暂停态口径，新增 overlay 与容器点击用例 |
| 文档 | spec 记录自动播放现态；`site-pages.md` 布局行与代码脱节 | 同 PR 同步 `site-pages.md`、`frontend-bookstore.md`、`apps/bookstore/AGENTS.md` |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/recordings-play-optimization`；
- 开发工作在**唯一开发分支** `feat/recordings-play-optimization` 上进行（自 `prd/recordings-play-optimization` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步；
- 开发前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`。要点：全 SSG、`app/` 只做路由组装、样式只用 `@theme` token 色（禁硬编码色值）、遵循 TDD、提交前 `pnpm lint && pnpm test && pnpm build` 全绿；
- e2e 步骤加载 SKILL: z-test。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/recordings-play-optimization` 切出 `feat/recordings-play-optimization` 并推送。

**验证**：`git branch --show-current` 为 `feat/recordings-play-optimization`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：player.ts autoplay 选项（TDD）

单测先行（红）——`apps/bookstore/tests/unit/recordings-player.test.ts` 新增用例（沿用既有 mock mpegts 范式）：

1. `play(url, video, { isLive: false, autoplay: false, ... })`：`player.load()` 被调用、`player.play()` **未**被调用；
2. 缺省不传 `autoplay`：`player.load()` 与 `player.play()` 均被调用（现状等价回归）；
3. `autoplay: false` 时归属订阅照常生效（`getPlayingUrl` 返回该 url）。

实现（绿）——`features/recordings/player.ts`：

1. `PlayOptions`（`:39`）增加 `autoplay?: boolean`（注释注明缺省 `true`，回放页传 `false` 规避浏览器自动播放拦截）；
2. `play()`（`:152`）：`player.load()` 后仅当 `options.autoplay !== false` 才 `void player.play()`（`:170-171`）；代次号丢弃过期实例、错误回调、缓冲配置等既有逻辑不动。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recordings-player.test.ts` 全绿。

### 步骤 2：FlvPlayerPanel 默认暂停 + 播放 overlay + 容器点击（TDD，F1）

单测先行（红，jsdom）——`tests/unit/flv-player-panel.test.tsx`：

1. 改写 `:122`「暂停按钮切换播放/暂停」：初始为「播放」按钮（`paused=true`）；点击后变为「暂停」，再点击回到「播放」（双入口状态一致性在本用例锁定）；
2. 新增「初始为暂停态」：挂载后 `paused=true`、控制条按钮 aria-label「播放」、播放按钮 overlay 存在（`aria-hidden` 视觉层）、`player.play()` 未被调用（断言注入的 mock）；
3. 新增「点击视频画面切换播放/暂停」：点击视频容器（`aspect-video` div）调用 `resumePlayer`、按钮变为「暂停」、overlay 隐藏；再次点击调用 `pausePlayer`、overlay 重现；
4. 新增「点击控制条不触发画面切换」：点击控制条容器（非全屏 wrapper / `data-testid="fullscreen-controls"`）不冒泡至视频容器（播放态不变）；
5. 既有断言保持：MSE 不支持降级（`:145`）不渲染 overlay、失败态（`failed`）不渲染 overlay、下载入口（`:153`）不变。

实现（绿）——`features/recordings/replay/FlvPlayerPanel.tsx`：

1. `paused` useState 初始值 `false` → `true`（`:105`）；`start()`（`:164-182`）中 `play()` 调用传 `autoplay: false`，并移除其中 `setPaused(false)`（就绪即暂停；重试路径 `togglePlay` 的 `!owns` 分支走 `start()` 同样落到暂停态，符合 PRD「重试后回到默认暂停态」）；
2. overlay：`paused && !failed && supported === true` 时在视频容器内、`{overlay}`（`:508`）之后渲染——`absolute inset-0 grid place-items-center pointer-events-none` + `aria-hidden="true"`，内部半透明深色圆形底板（token 色，如 `bg-night/60`）+ `lucide-react` `Play` 图标（`text-flower`），仅用 `@theme` token 色；
3. 视频容器 div（`:492-493`）加 `onClick={togglePlay}`；两处控制条渲染点加 `onClick={(e) => e.stopPropagation()}`——全屏悬浮层 `data-testid="fullscreen-controls"`（约 `:511`）与非全屏 wrapper（约 `:530`）；进度条/音量/全屏/下载子控件无需逐个处理（统一由控制条容器拦截）；
4. `togglePlay`（`:324-337`）逻辑零改动：初始暂停态下 `owns=true && paused=true` → `resumePlayer()` 通路天然兼容；
5. 弹幕浮层 `DanmakuOverlay` 为 `pointer-events-none`，点击天然穿透至容器，无需改动。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/flv-player-panel.test.tsx tests/unit/replay-stage.test.tsx` 全绿；`pnpm -C apps/bookstore lint` 通过。

### 步骤 3：布局类调整（TDD，F2）

单测先行（红）——`tests/unit/replay-stage.test.tsx` 新增/更新布局断言：

1. 视频列类含 `lg:w-4/5`（不含 `lg:w-3/4`）；事件列类含 `lg:w-1/5`、**不含** `lg:h-[70vh]`（非全屏分支）；
2. web 全屏分支 `timelineWrapperClass` 行为不变（`flex min-h-0 flex-col lg:w-1/5`，仅列宽同步、不加固定高度）；
3. 事件列与播放器列同处一个 `lg:flex-row` 弹性行（等高由 flex stretch 保证，结构断言）；
4. `tests/unit/replay-page.test.tsx`：三态容器类断言更新为 `px-1 lg:px-2`（若既有断言涉及留白类则同步改写，否则新增）。

实现（绿）——6 处类名级改动，不动任何结构：

1. `ReplayApp.tsx`：`:18`、`:74`、`:92` 三处容器 `px-2.5 lg:px-5` → `px-1 lg:px-2`（`py-24` 不动）；
2. `ReplayStage.tsx`：视频列 `:140` `lg:w-3/4` → `lg:w-4/5`；`timelineWrapperClass`（`:134-135`）两个分支 `lg:w-1/4` → `lg:w-1/5`，非全屏分支去除 `lg:h-[70vh]`；
3. `EventTimeline` 内部 `min-h-0 flex-1 overflow-y-auto` 滚动容器既有不变；移动端（`<lg`）无任何 `lg:` 前缀类变化，行为与现态一致。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/replay-stage.test.tsx tests/unit/replay-page.test.tsx` 全绿；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore build` 通过。

### 步骤 4：e2e（tests/e2e/src/bookstore/recordings-replay.spec.ts）

加载 SKILL: z-test。更新既有 spec（真实媒体播放与 canvas 动画不断言，沿用既有口径）：

1. 新增初始暂停态断言：回放页加载后控制条播放按钮 aria-label 为「播放」、播放按钮 overlay 可见（步骤 2 为 overlay 加 `data-testid="play-overlay"` 供断言）；
2. 舞台布局回归：既有三要素（`:147`）、全屏（`:204-244`）等 8 条用例零回归（mock FLV 流为空 body 播不起来的现状不变，不断言真实播放）；
3. 事件列表在桌面断点与视频列同屏可命中（既有断言覆盖），追加事件列高度与视频列高度一致的可观察断言（boundingBox 近似相等，容差 ≤ 控制条高度量级，实现期按实测校准）。

**验证**：`cd tests/e2e && pnpm playwright test src/bookstore/recordings-replay.spec.ts src/bookstore/recordings.spec.ts` 通过。

### 步骤 5：手工验证、spec 同步与收尾验收

1. **手工验证（本地 Aspire 编排，真实上游）**：打开回放页确认默认暂停 + overlay 展示、控制台无自动播放拦截错误；点击画面播放/暂停与控制条状态一致；web 全屏与 native 全屏下画面点击与 overlay 行为；桌面端事件列与播放器等高、列内滚动跟随/seek 不变；窗口缩至移动端断点布局回归纵向堆叠；iOS Safari（或禁用 MSE 模拟）降级态不展示 overlay；
2. `docs/product/spec/site-pages.md` 回放页节：补充「默认暂停 + 播放 overlay + 画面点击播放/暂停」现态；「布局」行（约 `:71`）更新为 4/5 + 1/5 等高与新留白口径，并顺带修正既有脱节（「约 2/3 宽」、已移除的「操作区」描述）；
3. `docs/engineering/spec/frontend-bookstore.md` 录播节：`player.ts` 的 `autoplay` 选项、`FlvPlayerPanel`（`:64`）补默认暂停/overlay/容器点击口径、留白新口径（`:74` `px-1 lg:px-2`）与列宽 4/5；
4. `apps/bookstore/AGENTS.md` 回放页约定节：`ReplayApp` 留白描述（`:100`）与 `FlvPlayerPanel` 行为描述（`:101`）同步；根 `AGENTS.md` 无变更（无结构与契约变更）；
5. 核对 PRD §1.3 成功标准、§3.2 F1/F2 验收标准与提案 §10 全量通过；
6. 推送 `feat/recordings-play-optimization`，提 PR 回合 `prd/recordings-play-optimization`（需求总 PR #146 随之更新）。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿；e2e 回放 spec 通过；手工验证清单逐项过；PRD/提案验收清单逐项勾选。

## 4. 依赖与风险

- **依赖**：`togglePlay`/`owns`/`paused` 既有机制（通路不变更）；`lucide-react`、`@theme` token 色、`EventTimeline` 滚动容器均既有，无新增依赖；录播系列前序需求（seek/fullscreen、replay-danmaku）均已合入，无在途并行需求触碰回放页；
- **风险**：`play()` 内 `void player.play()` 的 Promise 拒绝（自动播放拦截）现态未捕获——传 `autoplay: false` 后该路径不再触发，回放页天然规避；`LiveAudioButton` 仍走自动播放但由用户手势触发，不受影响（提案已锁定，步骤 1 用例回归缺省行为）；
- **风险**：web 全屏下控制条转为悬浮（不占流内高度），「事件列与播放器等高」口径仅适用非全屏流内布局——全屏分支本有独立布局，本期不改（提案风险点 1）；
- **风险**：视频元数据未就绪时画面为黑底 + overlay——属预期（用户点击后才解码播放）；`ReplayStage` 的 `playing=false` 使弹幕浮层静止，与初始暂停态一致（提案风险点 2）；
- **风险**：事件列去固定高度后，内容极少时 stretch 仍保证与播放器等高、条目不拉伸——由 `EventTimeline` 既有顶对齐布局保证；步骤 4 e2e 追加等高可观察断言兜底；
- **范围纪律**：不改录播列表页、弹幕浮层渲染逻辑、事件取数/窗口调度、seek、双全屏状态机本体、`LiveAudioButton`、`servers/api`/契约/编排资源；快捷键、暂停封面图、宽度自定义均不做（PRD §六）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-18-recordings-play-optimization-prd.md]]
- 技术提案：[[../proposals/2026-09-18-recordings-play-optimization-proposal.md]]
- 上一期实现方案（录播回放弹幕）：[[2026-09-17-recordings-replay-danmaku-impl-plan.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 开发规范：[[../frontend-rules.md]]
- 页面设计：`../../design/02-page-design.md`
