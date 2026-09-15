---
description: 录播优化一期实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的实施计划。需求总分支 prd/recordings-seek-fullscreen，唯一开发分支 feat/recordings-seek-fullscreen，纯前端变更（仅 apps/bookstore + 根 patches/ 与 pnpm-workspace.yaml 登记），无契约/后端/编排资源变更。TDD 串行推进：mpegts.js 钉版 + pnpm patch（暴露按字节偏移续播 seekToByteOffset）→ features/recordings/seek.ts 纯函数（码率估算 + FLV tag 边界扫描）与 seekUnbuffered 编排（last-wins 代次）→ player.ts 桥接 → FlvPlayerPanel 未缓冲 seek 编排与缓冲反馈（消除 50ms 死循环）→ 全屏/网页全屏状态机 → e2e mock 增补 → spec 同步收尾。
type: Permanent
---

# 录播优化一期实现方案（Implementation Plan）

**关联 PRD**: [[../../product/requirements/draft/2026-09-15-recordings-seek-fullscreen-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-09-15-recordings-seek-fullscreen-proposal.md]]（v1.0）
**需求总分支**: `prd/recordings-seek-fullscreen`（需求总 PR：<https://github.com/Deliay/sumire/pull/134>）
**开发分支**: `feat/recordings-seek-fullscreen`（自需求总分支切出，**唯一开发分支**，实现/单测/e2e/spec 同步全部同在此分支，与既有迭代同一口径）
**版本**: v1.0（2026-09-15）
**作者**: sumire workflow

本方案将技术提案 v1.0 落实为可执行的实施计划，遵循 TDD（每个功能步骤先补失败用例再实现）。纯前端变更：无契约、无 `servers/api`、无编排资源变更；仅 `apps/bookstore` 内功能代码 + 根级 `patches/mpegts.js@1.8.2.patch` 与 `pnpm-workspace.yaml` 的 `patchedDependencies` 登记。

**前提事实**（已在需求总分支 `prd/recordings-seek-fullscreen` 核对代码现态，commit 5714691）：

- 卡死路径现态：`apps/bookstore/features/recordings/FlvPlayerPanel.tsx:103-108` `handleSeek` 直接写 `video.currentTime`——`canSeek`（`:49`）为 `rangeSupported === true && duration > 0` 时进度条可拖；上游已支持 Range 使 `probeSeekable` 通过后该路径暴露，未缓冲落点触发 mpegts 50ms 校正死循环（根因见提案 §1.1）。本方案对**未缓冲**落点改走 `seekUnbuffered` 编排、不再写 `currentTime`；**已缓冲**落点维持现路径。
- player 单例现态：`features/recordings/player.ts`——模块级 `currentPlayer`/`currentUrl`（`:8-10`）、`generation` 代次丢弃（`:13`、`play()` `:92-109`）、`destroyPlayer(url?)` 归属语义（`:75-89`）、`probeSeekable`（`:54-69`，`Range: bytes=0-0` 探测后取消响应体）、`isPlaybackSupported()` 动态 `import("mpegts.js")`（`:34-37, 45-48`，SSG 期不求值浏览器全局）。seek 桥接与代次 last-wins 沿用该文件既有模式。
- 播放区结构现态：`FlvPlayerPanel.tsx`——视频容器 `:164`（`aspect-video` 黑底）、进度条 `:178-188`（`disabled={!canSeek}`）、控制条行 `:190-217`（播放/暂停、时间、音量 `ml-auto`，全屏按钮追加在音量之后）、Range 不支持明示 `:219`、错误提示 `:222-226`、关闭 `:125-128`（`destroyPlayer(url)` 后 `onClose`）。全屏容器需上移至包裹画面 + 控制条的公共父级。
- 数据输入现态：`features/recordings/api.ts:28-32` `RecordingFile` 已含 `size`（估算输入之一）；`recordingFileUrl()`（`:55-57`）经 `encodeURIComponent`，seek Range 窗口请求复用同一 url；`duration` 由 `video.duration`（`onMetaData.duration`）获得，未知前 `canSeek=false` 天然门控（`:49`）。
- 本地 dev 代理现态：`next.config.ts:17-23` 仅 dev 挂载 rewrites（`/recordings-proxy/:path*` → 内网录播服务）；**Range/206 透传行为需在实现期复验**（PRD §3.4 已列），不透传时 `probeSeekable=false` 走既有禁拖降级，不影响生产（生产为 CDN 直连已实测 206）。
- 依赖现态：`apps/bookstore/package.json:19` `mpegts.js: ^1.8.2`，lockfile 解析为精确 `1.8.2`（`pnpm-lock.yaml:2945`）；本方案钉为精确版本 `1.8.2`（去 `^`），patch 与版本强绑定。
- patch 登记现态：工作区无根 `package.json`；`pnpm-workspace.yaml` 现有 `packages`/`allowBuilds` 两键，pnpm 11.3.0 支持在该文件登记 `patchedDependencies`（提案 §5.2 实现点 1）。
- 测试设施现态：`apps/bookstore/tests/unit/flv-player-panel.test.tsx` 已存在（mock `@/features/recordings/player` 与 mpegts 行为的既有范式可直接扩展）；`tests/e2e/src/bookstore/recordings.spec.ts` 已存在（`page.route` mock 模式对齐 `calendar.spec.ts:144-153`）；vitest jsdom 用 `// @vitest-environment jsdom` 头注释（`apps/bookstore/vitest.config.ts`）。
- Spec 同步位置：`docs/product/spec/site-pages.md` 录播页 F5 节；`docs/engineering/spec/frontend-bookstore.md` 录播节；根 `AGENTS.md` 无变更（无结构与契约变更）。

整体顺序（**串行**，唯一开发分支 `feat/recordings-seek-fullscreen`）：
**切开发分支 → 依赖钉版 + pnpm patch（seekToByteOffset）→ seek.ts 纯函数与编排（TDD）→ player.ts 桥接（TDD）→ 播放区未缓冲 seek + 缓冲反馈（TDD）→ 全屏/网页全屏（TDD）→ e2e → spec 同步 + 收尾验收**。

## 1. 现状与差距

| 项 | 现状（已核对） | 本期目标（依据 PRD v1.0 / 提案 v1.0） |
|----|-----------------|----------------------------------------|
| 未缓冲 seek | `handleSeek` 一律写 `video.currentTime`，未缓冲落点触发 50ms 死循环卡死 | 未缓冲落点走 `seekUnbuffered`：码率估算 → Range 窗口取 256KB → tag 边界对齐 → patch `seekToByteOffset` 续播；全程不卡死 |
| 已缓冲 seek | 写 `currentTime` 即时定位（mpegts buffered 分支） | 维持现路径不变 |
| seek 反馈 | 无 seek 中状态，落点无数据时画面冻结无反馈 | `seeking` 态：进度条缓冲反馈 + 播放按钮 loading，杜绝无反馈冻结 |
| 并发 seek | 无（单例 generation 仅覆盖 play） | `seekUnbuffered` 代次 last-wins，过期探测结果丢弃；切换/关闭/卸载沿用 `destroyPlayer(url)` 归属语义 |
| 依赖补丁 | 无 patches 机制 | 新增 `patches/mpegts.js@1.8.2.patch`（TransmuxingController/MSEPlayer 暴露按字节偏移续播），`pnpm-workspace.yaml` 登记 `patchedDependencies`，`package.json` 钉 `1.8.2` |
| 全屏 | 无 | 控制条新增「全屏」（Fullscreen API，能力检测失败隐藏）与「网页全屏」（纯 CSS 视口铺满 + 滚动锁定），互斥、ESC/按钮退出、关闭播放区先复位 |
| 测试 | flv-player-panel 单测覆盖现态；e2e 覆盖列表/降级 | 新增 seek 纯函数用例、未缓冲 seek 编排用例、全屏状态机用例；e2e 增补全屏按钮与网页全屏断言 |
| 文档 | spec 记录「不可拖动 + 明示」旧现态 | 同 PR 同步 `site-pages.md`（F5 节）、`frontend-bookstore.md`（录播节） |

## 2. 分支与提交

- 本实现计划文档直接提交到需求总分支 `prd/recordings-seek-fullscreen`；
- 开发工作（实现 + 单测 + e2e + spec 同步）在**唯一开发分支** `feat/recordings-seek-fullscreen` 上进行（自 `prd/recordings-seek-fullscreen` 切出）；完成后提 PR 回合需求总分支，等待 review；
- 按步骤小步提交，提交信息 `<type>: <描述>`；禁止 rebase/squash，只 merge；
- 每个步骤完成后以该步骤的「验证」条目为准通过再进入下一步；
- 开发前加载 `apps/bookstore/AGENTS.md` 与 `docs/engineering/frontend-rules.md`；要点：全部页面 SSG、`app/` 只做路由组装、业务组件放 `features/<模块>/`、样式只用 `@theme` token 色禁硬编码、提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

## 3. 实施步骤

### 步骤 0：切开发分支

自 `prd/recordings-seek-fullscreen` 切出 `feat/recordings-seek-fullscreen` 并推送。

**验证**：`git branch --show-current` 为 `feat/recordings-seek-fullscreen`；`git log --oneline -1` 为需求总分支最新提交。

### 步骤 1：依赖钉版 + pnpm patch（暴露 seekToByteOffset）

本步骤为后续所有 seek 工作的地基，先独立落地并验证 patch 可应用、可复现。

1. `apps/bookstore/package.json`：`"mpegts.js": "^1.8.2"` → `"mpegts.js": "1.8.2"`（钉死，去 `^`）；
2. 新增 `patches/mpegts.js@1.8.2.patch`（基于 `pnpm patch mpegts.js@1.8.2` 工作流产出，针对包内未压缩构建产物）：
   - `TransmuxingController` 新增 `seekToByteOffset(fileposition, milliseconds)`：`_internalAbort()` → `_remuxer.seek(milliseconds)` + `insertDiscontinuity()` → `_loadSegment(0, fileposition)` → `_pendingResolveSeekPoint = milliseconds`；**不经过 `isSeekable()` 门**（该门语义为"有关键帧索引才能精确 seek"，本路径为近似 seek，由调用方保证 fileposition 为 tag 边界）；
   - `MSEPlayer`/`FlvPlayer` 上同名转发方法；
   - patch 行数控制在数十行内、可评审；
3. `pnpm-workspace.yaml` 追加 `patchedDependencies: { "mpegts.js@1.8.2": "patches/mpegts.js@1.8.2.patch" }`；
4. `pnpm install` 重装验证 patch 生效：grep `node_modules/.pnpm` 下 mpegts dist 产物含 `seekToByteOffset`；`pnpm -C apps/bookstore build` 通过（SSG 期不加载 mpegts，既有动态 import 机制不受影响）。

**验证**：全新 `pnpm install` 后 patch 自动应用（lockfile 记录 patch hash）；dist 产物含新方法；`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build` 全绿（零行为变更回归）。

### 步骤 2：seek.ts 纯函数与编排（TDD）

单测先行（红）：新增 `apps/bookstore/tests/unit/recordings-seek.test.ts`（node 环境）：

1. `estimateByteOffset(targetMs, durationMs, fileSize)`：线性估算 `floor(size × t / duration)`；边界——`t=0` 得 0、`t=duration` 钳制不超过 `fileSize-1`、非法输入（duration≤0）返回 0；
2. `findNextTagBoundary(window, baseOffset)`：以手工构造的 FLV 字节夹具验证——合法 tag 序列（tagType ∈ {8,9,18} + dataSize + timestamp + PrevTagSize=11+dataSize 一致性 + 下一 tag 头合法三重校验）返回正确 `fileposition` 与 `milliseconds`；纯噪声窗口返回 `null`；窗口尾部截断（不足以双重校验）放宽为单重校验；
3. `seekUnbuffered(args)`：`vi.stubGlobal("fetch", spy)` mock Range 窗口响应——发起 `Range: bytes=est-(est+256KB)` 请求、以扫描结果调用注入的 `seekToByteOffset` 回调（依赖注入便于单测，生产实参为 player 桥接）；扫描失败降级为「从 est 直接尝试」并允许 demux 失败走既有错误提示（返回 `false` 不抛错）；target 超时长钳制到末尾附近；fetch 失败返回 `false`。

实现（绿）：新增 `apps/bookstore/features/recordings/seek.ts`——导出提案 §3 的三个函数（签名见提案）；并发治理以模块级 `seekGeneration` 代次实现 last-wins（对齐 `player.ts:13` 模式）：每次 `seekUnbuffered` 递增代次，await 后比对，过期结果直接丢弃不触达播放器。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recordings-seek.test.ts` 全绿。

### 步骤 3：player.ts 桥接（TDD）

单测先行（红）：扩展或新增 `tests/unit/recordings-player.test.ts`（沿用既有 mpegts mock 范式）：

1. 新增 `seekToByteOffset(fileposition, milliseconds)`：当前有 player 实例时转发到 patched 实例方法一次；无实例时静默忽略（幂等）；
2. 转发不改变 `currentUrl`/generation 语义；`destroyPlayer()` 后调用为零操作；
3. patched 方法不存在（防御：patch 未生效）时安全返回不抛错。

实现（绿）：`features/recordings/player.ts` 追加 `seekToByteOffset` 导出（访问模块级 `currentPlayer` 转发）；不动既有 `play`/`destroyPlayer`/`probeSeekable` 逻辑。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/recordings-player.test.ts` 全绿。

### 步骤 4：播放区未缓冲 seek 编排 + 缓冲反馈（TDD，F1 核心）

单测先行（红）：扩展 `tests/unit/flv-player-panel.test.tsx`（jsdom，mock `@/features/recordings/player` 与 `@/features/recordings/seek`）：

1. 已缓冲落点（构造 `video.buffered` 覆盖目标）：仍直接写 `currentTime`，`seekUnbuffered` 零调用；
2. 未缓冲落点：调用 `seekUnbuffered`（参数含 url/target/duration/size）、**不写** `currentTime`；期间渲染缓冲反馈（进度条 seeking 态/按钮 loading，aria 可断言）；完成后反馈消失；
3. 快速连续 seek N 次：仅最后一次触达播放器（依赖 seek.ts 代次 last-wins，组件层断言调用参数为最后落点）；
4. seek 中切换文件/关闭播放区：`destroyPlayer(url)` 归属语义生效，过期 seek 结果不触达（配合 mock 代次断言）；
5. 回归：`probeSeekable=false` 时进度条禁用并展示「当前上游不支持拖动进度」（既有语义零回归）；`duration` 未知前进度条禁用；
6. seek 失败（`seekUnbuffered` 返回 false）：展示既有播放失败提示（`role="alert"`），列表其它交互不受影响。

实现（绿）：`FlvPlayerPanel.tsx` 改造 `handleSeek`——以 `video.buffered` 判断落点是否已缓冲：已缓冲维持现路径；未缓冲置 `seeking` 态并调用 `seekUnbuffered`（成功由 mpegts 经 `RECOMMEND_SEEKPOINT` 在 `_requestSetTime` 护栏下回写 `currentTime`，UI 经既有 `onTimeUpdate` 同步刷新；失败复位 seeking 并置错误提示）。新增 `seeking` state 驱动缓冲反馈 UI（进度条旁 loading 指示 + 播放按钮 loading 态，token 色与既有控件一致）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/flv-player-panel.test.tsx` 全绿；`pnpm -C apps/bookstore lint` 通过。

### 步骤 5：全屏与网页全屏（TDD，F2）

单测先行（红）：并入 `flv-player-panel.test.tsx`（mock Fullscreen API：`document.fullscreenEnabled`、元素 `requestFullscreen`/`exitFullscreen` spy、手动派发 `fullscreenchange`）：

1. 控制条渲染「全屏」「网页全屏」两个按钮（音量之后，`aria-label` 断言，键盘 Tab 可达、Enter/Space 触发）；
2. 点击「全屏」：容器（画面 + 控制条公共父级）调用 `requestFullscreen()`，按钮态切为「退出全屏」；
3. 派发 `fullscreenchange`（模拟 ESC）：状态复位为 `none`，按钮态还原；
4. 点击「网页全屏」：容器切 `fixed inset-0 z-50` 黑底（类名断言）、`document.body` 滚动锁定；退出还原类名与滚动；ESC 键监听退出；
5. 互斥：native 中点 web（或反之）先退出前一个再进入后一个，不叠加；
6. 关闭播放区/切换文件前：fullscreenMode 复位为 `none`（先退全屏再走既有语义）；
7. `document.fullscreenEnabled=false`：隐藏「全屏」按钮，「网页全屏」不受影响。

实现（绿）：`FlvPlayerPanel.tsx`——`fullscreenMode: "none" | "native" | "web"` 状态机（提案 §5.2 实现点 4）；全屏容器 `ref` 上移包裹视频容器 + 控制条；图标沿用 `lucide-react`（如 `Maximize`/`Minimize`/`Expand`/`Shrink`，风格对齐既有 `Play`/`X`）；web 全屏背景用 token 黑（对齐设计文档深色语义），焦点环沿用 `outline-flower`。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test` 全绿。

### 步骤 6：e2e（tests/e2e/src/bookstore/recordings.spec.ts）

加载 SKILL: z-test。沿用既有 `page.route` mock 模式扩展录播 spec：

1. 录播文件端点 mock 响应补 `Range: bytes=0-0` → `206`（`probeSeekable` 通过路径）：控制条出现「全屏」「网页全屏」按钮；
2. 点击「网页全屏」：容器类名断言 + body 滚动锁定断言；退出后还原；
3. `Range` 探测返回 `200`（不支持）：进度条禁用 + 明示文案（既有降级 e2e 零回归）；
4. 真实媒体 seek 与 native 全屏（headless 下 Fullscreen API 行为受限）不在 e2e 断言，以组件单测覆盖（对齐提案 §8.1 与上一期口径）。

**验证**：`cd tests/e2e && pnpm playwright test src/bookstore/recordings.spec.ts` 通过；既有 spec 不回归。

### 步骤 7：手工验证、spec 同步与收尾验收

1. **手工验证（真实上游，提案 §8.2 必做项）**：本地 dev 起 bookstore（录播基址指向可 Reach 的上游）——
   - 复验 dev 代理对 `Range`/`206` 的透传（不透传确认降级为禁拖 + 明示，不阻塞；PRD §3.4）；
   - patched seek 端到端：已缓冲即时续播、未缓冲秒级续播且有缓冲反馈、连续快速拖动不卡死、接近文件头/尾正常、拖动途中切换文件/关闭/离开页面正确销毁、长播暂停后再 seek（lazyLoad 交互，提案风险点）；
2. `docs/product/spec/site-pages.md` F5 节：进度条 seek 现态改为「已缓冲即时定位；未缓冲近似 seek（无关键帧索引时码率估算 + tag 边界对齐落点）」+ 全屏/网页全屏能力描述；
3. `docs/engineering/spec/frontend-bookstore.md` 录播节：`seek.ts` 模块（估算/边界扫描/last-wins）、patch 登记与版本钉死口径、`seekToByteOffset` 桥接、全屏状态机；
4. `apps/bookstore/AGENTS.md`：补 seek/patch 相关口径（如该文件有录播 feature 小节则同步）；根 `AGENTS.md` 无变更；
5. 核对 PRD §1.3 成功标准、§3.2 F1/F2 验收标准与提案 §10 全量通过；
6. 推送 `feat/recordings-seek-fullscreen`，提 PR 回合 `prd/recordings-seek-fullscreen`（需求总 PR #134 随之更新）。

**验证**：`pnpm lint && pnpm test`（workspace 级）+ `pnpm -C apps/bookstore build` 全绿；e2e 录播 spec 通过；手工验证清单逐项过；PRD/提案验收清单逐项勾选。

## 4. 依赖与风险

- **依赖**：上游 Range 支持稳定（2026-09-15 实测 206 + `Accept-Ranges: bytes`，CDN 命中）；录播列表 API 持续返回文件 `size`、`onMetaData` 含 `duration`（现态已满足）；pnpm 11 `patchedDependencies`；
- **风险**：patch 与 mpegts.js 版本强绑定——钉死 `1.8.2`（去 `^`），升级需同步重制 patch 并在 PR 中说明（步骤 1 锁定）；
- **风险**：patch 机制验证前置——`seekToByteOffset` 依赖 mpegts 内部 `_loadSegment(0, fileposition)` 跨段加载机制（提案已源码确认存在），步骤 1 独立落地先验证，若内部结构不符预期即刻暴露，不拖累后续步骤；
- **风险**：VBR 波动导致估算落点偏差大——一期接受近似落点（PRD 认可形态），不迭代收敛；扫描失败降级走既有播放失败提示，不卡死（步骤 2 用例锁定）；
- **风险**：demuxer 复用前提是会话内已播放过文件头——本方案 seek 均发生在播放启动后（`canSeek` 依赖 `duration`，天然门控），成立；
- **风险**：mpegts lazyLoad suspend/resume 与 patched 路径交互——步骤 7 手工验证「长播暂停后再 seek」场景；
- **风险**：dev 代理不透传 Range——实现期复验，不透传走既有禁拖降级（生产 CDN 直连不受影响）；
- **范围纪律**：不改 `servers/api`/契约/编排资源；上游注入关键帧索引、精确到帧 seek、快捷键/倍速/记忆播放位置均不做（PRD §六）。

## 5. 相关文档

- PRD：[[../../product/requirements/draft/2026-09-15-recordings-seek-fullscreen-prd.md]]
- 技术提案：[[../proposals/2026-09-15-recordings-seek-fullscreen-proposal.md]]
- 上一期实现方案（录播页）：[[2026-09-14-recordings-page-impl-plan.md]]
- 产品 Spec（现态）：`../../product/spec/site-pages.md`
- 工程 Spec（现态）：`../spec/frontend-bookstore.md`
- 前端规范：[[../frontend-rules.md]]
- 页面设计：`../../design/02-page-design.md`
