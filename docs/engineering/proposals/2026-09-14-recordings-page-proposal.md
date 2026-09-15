---
description: 录播页技术提案——纯前端方案：bookstore 新增 /recordings 页面，前端经构建期环境变量直连录播服务（线上 CDN 已配置跨域，本地开发内部接口走转发，无 CORS 改造与 API 代理），实现录制状态轮询、听直播、按直播间折叠分页的录播列表、mpegts.js FLV 在线预览与下载；导航新增「录播」并将「小密室」移至 Footer
type: Fleeting
---

# 录播页 - 技术提案

**功能名称**: 录播页（Recordings Page）
**关联 PRD**: `docs/product/requirements/draft/2026-09-14-recordings-page-prd.md`
**技术提案版本**: v1.1（返工修订：移除 servers/api 代理与契约设计，改为前端直连录播服务——线上 CDN 已配置跨域，本地开发内部接口走转发）
**创建日期**: 2026-09-14
**作者**: sumire workflow
**prd-branch**: `prd/recordings-page`（需求总分支）
**feat-branch**: `feat/recordings-page`（开发分支，实现时自需求总分支合入 main 后切出）

## 1. 概述

### 1.1 背景

录播服务对外提供四组 API（内网 `http://vtuber.internal.fffdan.com`，外网 `https://recordings.vtuber.fffdan.com`）：

| 上游端点 | 实测响应 |
|----------|----------|
| `GET /api/b/live/recording-status` | `{items: [{mid, roomId, state: "recording"\|"not_live", hostName, sessionTitle, files: string[], error, updatedAt, streamer: {name}}]}` |
| `GET /api/b/live/:roomId/recordings` | `{files: [{name, size, createdAt}]}`（name 含中文/特殊字符，单场可达数 GB） |
| `GET /api/b/live/:roomId/recordings/:fileName` | FLV 字节流，`Content-Disposition: attachment; filename*=UTF-8''...` |
| `GET /api/b/live/:roomId/live-stream/audio` | 长连接 FLV 音频流，`Content-Type: video/x-flv` |

数据通路（已与需求方确认并实测）：**线上 CDN 已为站点源配置跨域放行**——以 `Origin: https://sumire.live` 请求外网录播服务，响应携带 `Access-Control-Allow-Origin: https://sumire.live`（白名单制，非站点源不放行）；**本地开发时内部接口走转发**，同样无需跨域设置。因此前端可直接跨域调用录播服务（含 JSON 接口与 MSE 所需的 FLV fetch），本期为纯前端功能：不改 `servers/api`、不新增契约、不改编排资源。

导航现态：`apps/bookstore/components/NavBar.tsx` 末尾有外链项「小密室」（`EXTERNAL_LINKS`，NavBar.tsx:38）；`Footer.tsx` 外链区现有 B 站空间/直播间/萌娘百科三项（数据来自 `lib/content` 的 `site.links`）。

### 1.2 目标

- `apps/bookstore` 新增 `/recordings` 页面与 `features/recordings/` 模块：状态轮询、听直播、折叠分页录播列表、FLV 在线预览与下载；
- 录播服务基址由构建期环境变量注入（生产=外网地址，本地=转发后的内网地址），未配置时入口与页面静默降级；
- `NavBar` 新增「录播」项并移除「小密室」外链项；`Footer` 外链区新增「小密室」。

### 1.3 范围

- **做**：录播页与前端组件 + 单测/e2e；导航与 Footer 调整；构建期环境变量接入；实现 PR 内同步 spec。
- **不做**：`servers/api` / 契约 / 数据库 / Aspire 资源变更；录播检索/收藏；弹幕回放；iOS MSE 受限的完整兜底（仅提示 + 下载）；录播数据落库（本站不存储任何录播数据）；上游服务自身改造。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph LR
    subgraph 浏览器（静态导出页）
        PAGE[/recordings 页面<br/>features/recordings/]
        PLAYER[mpegts.js 播放器<br/>MSE]
    end
    UPSTREAM[录播服务<br/>生产: recordings.vtuber.fffdan.com<br/>本地: 转发 → vtuber.internal.fffdan.com]

    PAGE -->|JSON fetch<br/>recording-status / recordings| UPSTREAM
    PLAYER -->|FLV fetch 流<br/>live-stream/audio / recordings/:fileName| UPSTREAM
    PAGE -.->|构建期注入基址<br/>NEXT_PUBLIC_RECORDINGS_BASE_URL| ENV[构建环境变量]
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js 16 + React 19（既有，静态导出） | `app/(site)/(content)/recordings/page.tsx` + `features/recordings/` 客户端组件 |
| FLV 播放 | `mpegts.js`（新增依赖） | flv.js 的维护 fork，MSE 边下边播；音频流与文件预览共用 |
| 配置 | 构建期环境变量（既有模式） | `NEXT_PUBLIC_RECORDINGS_BASE_URL`，对齐 `NEXT_PUBLIC_API_BASE_URL` 先例 |
| 测试 | Vitest + Testing Library；Playwright | 单测 / e2e（`page.route` mock，对齐 calendar.spec.ts 模式） |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `apps/bookstore/features/recordings/api.ts` | 请求封装 | 基址注入、路径编码、降级语义（对齐既有 `request()` 风格但独立基址） |
| `apps/bookstore/features/recordings/` 组件 | 状态列表 / 听直播 / 折叠列表 / 播放区 | 30s 轮询（可见性感知）、单例播放、前端分页 |
| `apps/bookstore/app/(site)/(content)/recordings/page.tsx` | 页面组装 | 自动获得 NavBar + Footer 外壳 |
| `NavBar.tsx` / `Footer.tsx` / `lib/content` | 导航与页脚调整 | 「录播」项门控；「小密室」迁移 |

## 3. API 设计

无本站 API 变更，无契约变更。前端直接消费上游四组端点（见 1.1 实测结构），前端侧做最小归一化（去 `hostName`/`error` 等内部字段）：

```ts
// features/recordings/api.ts 对外暴露的前端模型
interface RecordingStatusItem {
  roomId: number;
  mid: number;
  streamerName: string;  // 上游 streamer.name
  state: "recording" | "not_live";  // 未知值按非 recording 处理
  sessionTitle: string | null;
  updatedAt: string;      // ISO 8601
}

interface RecordingFile {
  name: string;   // 原始文件名（含中文/特殊字符）
  size: number;   // 字节
  createdAt: string;
}
```

请求路径构造：基址 + `/api/b/live/...`，`fileName` 经 `encodeURIComponent` 编码后拼入路径。

## 4. 数据模型

无持久化变更。前端组件 state 持有状态列表与已展开房间的录播列表，刷新即弃，无缓存层。

## 5. 技术实现方案

### 5.1 核心流程

- **基址注入**：`NEXT_PUBLIC_RECORDINGS_BASE_URL` 构建期注入（对齐 `NEXT_PUBLIC_API_BASE_URL` 既有模式）；为空即 `RECORDINGS_CONFIGURED=false`，导航入口不渲染、页面展示「服务未配置」空态、不发起请求。生产构建注入 `https://recordings.vtuber.fffdan.com`；本地开发注入转发后的内网接口地址。
- **录制状态轮询**：页面挂载后 `useEffect` 拉取 `recording-status`，`setInterval` 30s；监听 `visibilitychange`，隐藏时清定时器、恢复可见时立即拉一次（对齐 PRD F2）。
- **听直播**：点击「听直播」→ mpegts.js 创建 player 挂到隐藏 `<video>` 拉流 `{BASE}/api/b/live/:roomId/live-stream/audio`；全局单例：播放新流前 `destroy` 旧 player；组件卸载 `destroy`。
- **录播列表**：`recording-status` 的 items 渲染为折叠分组头；展开时按需拉取该 roomId 的 `recordings`（结果存组件 state，不重复请求）；前端分页 pageSize=20（slice 已拉取数组）。
- **在线预览 / 下载**：点击文件项 → 播放区以 mpegts.js 加载 `{BASE}/api/b/live/:roomId/recordings/:fileName` 顺序播放；「下载」为 `<a href={同一 URL} download>`，命中上游 `Content-Disposition: attachment` 原生下载。

### 5.2 关键实现点

#### 实现点 1: 请求封装与基址配置（features/recordings/api.ts）

- 模块内读取 `process.env.NEXT_PUBLIC_RECORDINGS_BASE_URL`，导出 `RECORDINGS_CONFIGURED` 与基址常量；封装 `getRecordingStatus()` / `getRoomRecordings(roomId)`，失败返回降级值（`{ok:false,...}` 风格对齐 `features/home/api.ts` 的 `getLiveStatus()` 静默降级先例）；
- 不复用 `features/backdoor/api.ts` 的 `request()`（其绑定 `API_BASE_URL` 与 `credentials: "include"`，录播服务为独立的公开只读基址，无需带凭据）；保持fetch 最小封装；
- **风险点**：基址末尾斜杠与路径拼接——封装内统一 `joinUrl` 处理，避免 `//` 或漏 `/`。

#### 实现点 2: FLV 播放（前端）

- 引入 `mpegts.js`（唯一新增运行时依赖）：`mpegts.createPlayer({ type: "flv", isLive: true|false, url })` + `attachMediaElement(video)`；音频流 `isLive: true`，文件预览 `isLive: false`；
- 能力检测：`mpegts.isSupported()` 为 false（如 iOS Safari 无 MSE）时播放区展示「当前浏览器不支持在线播放，请下载后收听」+ 下载按钮（PRD 4.3 降级）；
- 单例管理：`features/recordings/` 内播放器单例（ref/模块级变量），保证任何时刻至多一个 player 实例；错误事件映射为用户提示并复位 UI；
- **风险点**：实测经 CDN 的 `Range` 请求返回 416，按上游不支持 Range 设计——mpegts.js 顺序播放、禁用 seek、进度条只读展示已播放时长；实现期复验（直连与经 CDN 各试一次），若支持则放开 seek。

#### 实现点 3: 页面与组件（前端）

- `app/(site)/(content)/recordings/page.tsx` 服务端壳（metadata + `<RecordingsApp />` 客户端组件）；`features/recordings/` 下：`api.ts`、`RecordingStatusList.tsx`、`LiveAudioButton.tsx`、`RoomRecordingsGroup.tsx`（折叠 + 分页）、`FlvPlayerPanel.tsx`；
- `RECORDINGS_CONFIGURED=false` 时页面渲染「服务未配置」空态、不发起请求（对齐 calendar/topics 的 `API_CONFIGURED` 降级先例）；
- 视觉遵循 `docs/design/02-page-design.md`：`max-w-6xl` 内容区、深色卡片、录制中用药丸形 eye 色呼吸点（复用 `LiveStatus` 语义色）、焦点环 `--color-flower`、键盘可达。

#### 实现点 4: 导航与 Footer 调整

- `NavBar.tsx`：在 `ongoingLink`（棉花糖）同组、工具项之前追加 `{ navKey: "recordings", label: "录播", anchor: "/recordings", route: "/recordings", kind: "internal" }`，以 `RECORDINGS_CONFIGURED` 门控；`isActive` 走路由精确匹配分支（`pathname === "/recordings"`），首页内无 `sectionId` 故不触发 deck 翻页（与棉花糖一致）；删除 `EXTERNAL_LINKS` 及「小密室」外链项（`ExternalLink` 类型与外链渲染分支如无其他使用则一并移除，保持 diff 最小）；
- `Footer.tsx` / `lib/content`：`site.links` 新增 `secretRoom: "https://sumire.icu"`，Footer links 数组末尾追加「小密室」；
- **风险点**：「小密室」导航项的既有单测（nav-bar.test.tsx 外链用例组，2026-09-13 引入）需要同步改为 Footer 断言——属接口变更的正常测试更新，不改其余导航用例。

#### 实现点 5: Spec 同步（实现 PR 内）

- `docs/product/spec/site-pages.md`：新增 `/recordings` 页现态；导航项清单更新（+录播 −小密室）；Footer 外链 +小密室；
- `docs/engineering/spec/frontend-bookstore.md`：录播 feature 模块、mpegts.js 依赖、`NEXT_PUBLIC_RECORDINGS_BASE_URL` 环境变量、NavBar/Footer 模型；
- 根 `AGENTS.md` 无需变更（无结构与契约变更）。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 前端取数路径 | 浏览器直连录播服务 | servers/api 代理 | A | 线上 CDN 已为站点源配置跨域（实测 `ACAO: https://sumire.live`），本地开发内部接口走转发；代理只会增加维护面与媒体流量中转开销 |
| 基址来源 | 构建期 env `NEXT_PUBLIC_RECORDINGS_BASE_URL` | 硬编码 / 运行时探测 | A | 对齐 `NEXT_PUBLIC_API_BASE_URL` 既有模式；生产=外网、本地=转发地址，构建期确定，静态导出天然适配 |
| FLV 播放 | mpegts.js（MSE） | 原生 `<video>` / 自研 demux | A | 浏览器不原生支持 FLV；mpegts.js 是 flv.js 的维护 fork，成熟且轻 |
| 录播列表交互 | 按直播间折叠展开 | 穿透进入子路由 | A | PRD 允许二选一；折叠展开无需路由跳转、状态保留简单，房间数少（实测 4 个）无需独立页面 |
| 分页 | 前端分页（pageSize=20） | 服务端分页 | A | 上游无分页参数；单房间文件量级有限，前端 slice 即可 |
| 状态刷新 | 30s 客户端轮询 | SSE / WebSocket | A | 上游无推送能力；对齐站内 LiveStatus 的轻量拉取语义（加可见性暂停） |
| 小密室迁移 | Footer links 数据加 `secretRoom` | Footer 内硬编码 | A | Footer 外链以 `lib/content` 的 `site.links` 为单一事实源，遵循既有结构 |
| 录播导航门控 | `RECORDINGS_CONFIGURED` 门控 | 复用 `API_CONFIGURED` / 恒显示 | A | 数据通路独立于本站 API，应随录播基址是否配置而显隐；语义比复用 `API_CONFIGURED` 准确 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | 录播服务内/外网可用，API 形态稳定 | 结构按 2026-09-14 实测编写 |
| 依赖 | 线上 CDN 跨域白名单覆盖站点源 | 已实测 `https://sumire.live` 放行；站点域变更需同步白名单 |
| 依赖 | 新增 `mpegts.js` npm 依赖 | 仅此一个新增运行时依赖 |
| 约束 | 上游 Range 行为未知（经 CDN 实测 416） | 播放按顺序流设计，实现期复验 |
| 约束 | TDD；`pnpm lint && pnpm test` 全绿 | 先测试后实现 |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/recordings-page` → 合入 main 后切 `feat/recordings-page` |

## 7. 项目结构

```
apps/bookstore/
├── app/(site)/(content)/recordings/
│   └── page.tsx                          # 新增：页面壳
├── features/recordings/
│   ├── api.ts                            # 基址注入 + 请求封装（降级语义）
│   ├── RecordingStatusList.tsx           # F2 + F3
│   ├── RoomRecordingsGroup.tsx           # F4 折叠 + 前端分页
│   └── FlvPlayerPanel.tsx                # F5 预览/下载 + MSE 降级提示
├── components/NavBar.tsx                 # +「录播」门控项 −「小密室」外链
├── components/Footer.tsx                 # +「小密室」外链
├── lib/content                           # site.links + secretRoom
└── tests/unit/                           # recordings 组件用例 + nav-bar/footer 用例更新
tests/e2e/src/bookstore/recordings.spec.ts  # page.route mock 对齐 calendar.spec.ts
docs/product/spec/site-pages.md           # 实现 PR 内同步
docs/engineering/spec/frontend-bookstore.md  # 实现 PR 内同步
```

## 8. 测试策略

### 8.1 测试覆盖要求

- **前端单测（Vitest）**：`api.ts` 基址注入与降级语义（含未配置时不发请求）；状态列表渲染与轮询（fake timers + visibilitychange）；折叠分组展开拉取一次、分页不重复请求；播放区在 `isSupported()=false` 时的降级 UI（mock mpegts.js）；NavBar「录播」门控与选中态、无「小密室」；Footer 含「小密室」属性断言。
- **e2e（Playwright）**：`page.route` 拦截录播服务四个端点路径返回夹具（对齐 `calendar.spec.ts` 的 mock 模式）：页面渲染、导航跳转、折叠展开与分页、下载链接 href；真实媒体播放不在 e2e 断言（流式媒体在 e2e 不稳定），以「player 初始化被调用」的桩断言替代。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library | 组件交互、降级、门控、导航/Footer |
| API 测试 | 不新增 | 无本站 API 变更（纯前端功能） |
| e2e | Playwright | 页面骨架、导航、列表交互（mock 上游） |

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地联调 | 既有 Aspire 编排 | 录播基址注入转发后的内网接口地址（内部接口走转发），无新增编排资源 |
| 生产 | 既有 bookstore SSG 发布 | 构建流水线注入 `NEXT_PUBLIC_RECORDINGS_BASE_URL=https://recordings.vtuber.fffdan.com` |

### 9.2 配置管理

- 新增构建期环境变量 `NEXT_PUBLIC_RECORDINGS_BASE_URL`（空=未配置降级）；无 `servers/api` env、无 Redis、无其他运行时配置。

## 10. 验收标准

- [ ] 技术方案评审通过
- [ ] `/recordings` 页面满足 PRD F1–F5 全部验收标准（含轮询、单例播放、折叠分页、预览/下载、MSE 降级提示）
- [ ] 导航 +「录播」−「小密室」、Footer +「小密室」，既有导航零回归
- [ ] 未配置 `NEXT_PUBLIC_RECORDINGS_BASE_URL` 时入口隐藏、页面空态降级
- [ ] `pnpm lint && pnpm test` 全绿；e2e 录播 spec 通过
- [ ] Spec 同步：`site-pages.md`、`frontend-bookstore.md`

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-09-14-recordings-page-prd.md`
- 站点页面 Spec（现态）：`docs/product/spec/site-pages.md`
- 前端 Spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 开发规范：`docs/engineering/frontend-rules.md`
- 页面设计：`docs/design/02-page-design.md`
