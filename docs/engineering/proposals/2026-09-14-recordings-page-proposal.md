---
description: 录播页技术提案——servers/api 新增录播代理路由（recording-status / recordings 列表 / FLV 文件 / 实时音频流，上游无 CORS 故必须代理），bookstore 新增 /recordings 页面（录制状态轮询、听直播、按直播间折叠分页的录播列表、mpegts.js FLV 在线预览与下载），导航新增「录播」并将「小密室」移至 Footer
type: Fleeting
---

# 录播页 - 技术提案

**功能名称**: 录播页（Recordings Page）
**关联 PRD**: `docs/product/requirements/draft/2026-09-14-recordings-page-prd.md`
**技术提案版本**: v1.0
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
| `GET /api/b/live/:roomId/recordings/:fileName` | FLV 字节流，`Content-Disposition: attachment; filename*=UTF-8''...`；实测 `Range` 请求返回 416，按**不支持 Range** 对待（实现期复验） |
| `GET /api/b/live/:roomId/live-stream/audio` | 长连接 FLV 音频流，`Content-Type: video/x-flv` |

关键约束（实测确认）：**上游所有端点均无 CORS 头**（无 `Access-Control-Allow-Origin`，`OPTIONS` 预检 405）。本站前端是 GitHub Pages 静态导出，浏览器直接 `fetch` 上游会被 CORS 拦截；FLV 播放（MSE 走 fetch）与 JSON 接口同理。因此必须经 `servers/api` 代理——这同时契合站内既有「内网上游 + Redis 短缓存 + 静默降级」的代理模式（live-status / live-history / peer-status 均是如此，上游同为 `vtuber.internal.fffdan.com`）。

导航现态：`apps/bookstore/components/NavBar.tsx` 末尾有外链项「小密室」（`EXTERNAL_LINKS`，NavBar.tsx:38）；`Footer.tsx` 外链区现有 B 站空间/直播间/萌娘百科三项（数据来自 `lib/content` 的 `site.links`）。

### 1.2 目标

- `servers/api` 新增录播代理路由组，覆盖录制状态、录播列表、FLV 文件（下载/预览）、实时音频流四类端点；
- `apps/bookstore` 新增 `/recordings` 页面与 `features/recordings/` 模块：状态轮询、听直播、折叠分页录播列表、FLV 在线预览与下载；
- `NavBar` 新增「录播」项（`API_CONFIGURED` 门控）并移除「小密室」外链项；`Footer` 外链区新增「小密室」；
- 新增 `contract/live-recordings.openapi.yaml` 作为代理端点契约的单一事实源。

### 1.3 范围

- **做**：契约文件；API 代理路由 + API 测试；录播页与前端组件 + 单测/e2e；导航与 Footer 调整；实现 PR 内同步 spec。
- **不做**：录播检索/收藏；弹幕回放；iOS MSE 受限的完整兜底（仅提示 + 下载）；录播数据落库（本站不存储任何录播数据）；上游服务自身改造。

## 2. 技术架构

### 2.1 系统架构图

```mermaid
graph LR
    subgraph 浏览器（静态导出页）
        PAGE[/recordings 页面/]
        PLAYER[mpegts.js 播放器<br/>MSE]
    end
    subgraph servers/api
        ROUTES[/api/live/recording-status<br/>/api/live/:roomId/recordings<br/>/api/live/:roomId/recordings/:fileName<br/>/api/live/:roomId/live-stream/audio/]
        CACHE[(Redis 短缓存<br/>仅元数据)]
    end
    UPSTREAM[录播服务<br/>vtuber.internal.fffdan.com/api/b/live]

    PAGE -->|JSON fetch| ROUTES
    PLAYER -->|FLV fetch 流| ROUTES
    ROUTES --> CACHE
    ROUTES -->|元数据: 缓存+降级<br/>媒体: 流式 pipe 透传| UPSTREAM
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 前端 | Next.js 16 + React 19（既有，静态导出） | `app/(site)/(content)/recordings/page.tsx` + `features/recordings/` 客户端组件 |
| FLV 播放 | `mpegts.js`（新增依赖） | flv.js 的维护 fork，MSE 边下边播；音频流与文件预览共用 |
| 后端 | Express 5 + TS strict（既有） | 新增 `routes/liveRecordings.ts`，照 live-history 代理模式 |
| 契约 | OpenAPI YAML（既有） | 新增 `contract/live-recordings.openapi.yaml` |
| 测试 | Vitest + Testing Library；tests/api（fetch + Cookie jar）；Playwright | 单测 / API 黑盒 / e2e（`page.route` mock，对齐 calendar.spec.ts 模式） |

### 2.3 模块划分

| 模块 | 职责 | 关键技术点 |
|------|------|-----------|
| `contract/live-recordings.openapi.yaml` | 四个代理端点的请求/响应契约 | 单一事实源 |
| `servers/api/src/routes/liveRecordings.ts` | 上游代理 | 元数据：Redis 短 TTL + 降级不产 5xx；媒体：`pipe` 流式透传 + `no-store` |
| `servers/api/src/config.ts` | 上游基址配置 | 复用/新增录播上游 env（缺省 `http://vtuber.internal.fffdan.com`） |
| `apps/bookstore/features/recordings/api.ts` | 前端请求封装 | 基于既有 `request()` / `API_BASE_URL`，降级语义 |
| `apps/bookstore/features/recordings/` 组件 | 状态列表 / 听直播 / 折叠列表 / 播放区 | 30s 轮询（可见性感知）、单例播放 |
| `apps/bookstore/app/(site)/(content)/recordings/page.tsx` | 页面组装 | 自动获得 NavBar + Footer 外壳 |
| `NavBar.tsx` / `Footer.tsx` / `lib/content` | 导航与页脚调整 | 「录播」项门控；「小密室」迁移 |

## 3. API 设计

新增 `contract/live-recordings.openapi.yaml`（本站 API 契约，路径前缀 `/api`），上游字段做最小归一化（去 `hostName`/`error` 等内部字段）：

### 3.1 `GET /api/live/recording-status`（公开）

- 上游：`GET {UPSTREAM}/api/b/live/recording-status`；
- 200：`{ ok: true, items: [{ roomId: number, mid: number, streamerName: string, state: "recording" | "not_live", sessionTitle: string | null, updatedAt: string }] }`；
- 上游故障：`{ ok: false, items: [] }`（200，静默降级，不产 5xx，对齐 live-status）；
- 缓存：Redis 30s TTL。

### 3.2 `GET /api/live/:roomId/recordings`（公开）

- `roomId` 校验为纯数字，非法 400；
- 200：`{ ok: true, files: [{ name: string, size: number, createdAt: string }] }`，按 `createdAt` 倒序；
- 降级 `{ ok: false, files: [] }`；缓存 60s TTL（文件列表变化频率低于状态）。

### 3.3 `GET /api/live/:roomId/recordings/:fileName`（公开，媒体）

- 下载与在线预览共用端点；`fileName` 经路径参数传递，服务端校验（非空、不含 `/`、`..`、长度上限），非法 400；
- 行为：上游响应流式 `pipe` 透传，转发 `Content-Type` / `Content-Length` / `Content-Disposition`（保持原始文件名，浏览器下载即原名）；响应 `Cache-Control: no-store`；
- `Range` 处理：上游实测不支持 Range（416），代理默认**不透传 Range**、整流顺序传输；实现期复验上游 Range 行为，若支持则透传并在契约补充；
- 不做 Redis 缓存；不做整文件缓冲（流式 pipe，背压交给流）。

### 3.4 `GET /api/live/:roomId/live-stream/audio`（公开，媒体）

- 长连接流式透传（`Content-Type: video/x-flv`），`Cache-Control: no-store`；客户端断开即中断上游连接；
- 上游不可用 / 未在直播时按上游状态码透传（404/502），前端据此复位「听直播」按钮。

## 4. 数据模型

无持久化变更（不触 MongoDB）。代理层仅做上游模型的最小归一化：

```ts
interface RecordingStatusItem {
  roomId: number;
  mid: number;
  streamerName: string;  // 上游 streamer.name
  state: "recording" | "not_live";  // 未知值原样透传为 string，前端按非 recording 处理
  sessionTitle: string | null;
  updatedAt: string;      // ISO 8601
}

interface RecordingFile {
  name: string;   // 原始文件名（含中文/特殊字符）
  size: number;   // 字节
  createdAt: string;
}
```

Redis 键：`recordings:status`、`recordings:list:{roomId}`（TTL 见上，对齐既有键名风格，实现时对齐 `backend-live.md` 现态）。

## 5. 技术实现方案

### 5.1 核心流程

- **录制状态轮询**：页面挂载后 `useEffect` 拉取 `recording-status`，`setInterval` 30s；监听 `visibilitychange`，隐藏时清定时器、恢复可见时立即拉一次（对齐 PRD F2）。
- **听直播**：点击「听直播」→ mpegts.js 创建 player 挂到隐藏 `<video>`（或 `<audio>` 语义容器）拉流 `/api/live/:roomId/live-stream/audio`；全局单例：播放新流前 `destroy` 旧 player；组件卸载 `destroy`。
- **录播列表**：`recording-status` 的 items 渲染为折叠分组头；展开时按需拉取该 roomId 的 `recordings`（结果存组件 state，不重复请求）；前端分页 pageSize=20（slice 已拉取数组）。
- **在线预览 / 下载**：点击文件项 → 播放区以 mpegts.js 加载 `/api/live/:roomId/recordings/:fileName`（`encodeURIComponent` 编码文件名）顺序播放（无 Range 则进度条只读、禁 seek）；「下载」为 `<a href={同一 URL} download>`，命中上游 `Content-Disposition: attachment` 原生下载。

### 5.2 关键实现点

#### 实现点 1: API 代理路由（servers/api）

- 新增 `routes/liveRecordings.ts`，挂载于 `/api/live` 之下；元数据两端点照抄 live-history 模式（`config.ts` 上游基址 env + Redis GET/SETEX + try/catch 降级 200）；
- 媒体两端点用流式透传：Node `fetch`（或 `http.request`）拿到上游响应后 `Readable.fromWeb(res.body).pipe(res)`，透传选择性响应头，`no-store`；`req.on("close")` 时中止上游请求，避免客户端断开后继续拉流；
- **风险点 1**：Express 5 通配/路径参数对含特殊字符的 `fileName` 的解析——`fileName` 已 `encodeURIComponent`，服务端 `decodeURIComponent` 后做白名单校验再拼上游 URL；
- **风险点 2**：单文件数 GB，严禁 `await res.text()/buffer()`；pipe 是唯一正确形态，API 测试需覆盖「响应为流且首字节到达时间不被整文件阻塞」的轻量断言（stub 上游返回分块流）；
- **风险点 3**：CORS——经本站 API 后响应带既有 CORS 中间件头，前端跨源（Pages → api.sumire.live）fetch/MSE 可用；媒体端点确认不被 CORS 中间件的缓存头策略干扰。

#### 实现点 2: FLV 播放（前端）

- 引入 `mpegts.js`（唯一新增运行时依赖）：`mpegts.createPlayer({ type: "flv", isLive: true|false, url })` + `attachMediaElement(video)`；音频流 `isLive: true`，文件预览 `isLive: false`；
- 能力检测：`mpegts.isSupported()` 为 false（如 iOS Safari 无 MSE）时播放区展示「当前浏览器不支持在线播放，请下载后收听」+ 下载按钮（PRD 4.3 降级）；
- 单例管理：`features/recordings/player.ts` 或组件内 ref，保证任何时刻至多一个 player 实例；错误事件（`ERROR` / `STATISTICS_INFO` 异常）映射为用户提示并复位 UI；
- **风险点**：无 Range 时 mpegts.js 顺序播放 seek 不可用——隐藏/禁用 seek 交互，仅展示已播放时长；实现期若上游 Range 复验通过再放开。

#### 实现点 3: 页面与组件（前端）

- `app/(site)/(content)/recordings/page.tsx` 服务端壳（metadata + `<RecordingsApp />` 客户端组件）；`features/recordings/` 下：`api.ts`、`RecordingStatusList.tsx`、`LiveAudioButton.tsx`、`RoomRecordingsGroup.tsx`（折叠 + 分页）、`FlvPlayerPanel.tsx`；
- `API_CONFIGURED=false` 时页面渲染「服务未配置」空态、不发起请求（对齐 calendar/topics 降级先例）；
- 视觉遵循 `docs/design/02-page-design.md`：`max-w-6xl` 内容区、深色卡片、录制中用药丸形 eye 色呼吸点（复用 `LiveStatus` 语义色）、焦点环 `--color-flower`、键盘可达。

#### 实现点 4: 导航与 Footer 调整

- `NavBar.tsx`：在 `ongoingLink`（棉花糖）同组、工具项之前追加 `{ navKey: "recordings", label: "录播", anchor: "/recordings", route: "/recordings", kind: "internal" }`，同样 `API_CONFIGURED` 门控；`isActive` 走路由精确匹配分支（`pathname === "/recordings"`），首页内无 `sectionId` 故不触发 deck 翻页（与棉花糖一致）；删除 `EXTERNAL_LINKS` 及 `ExternalLink` 相关渲染分支（小密室下架后无外链项；分支保留与否以 diff 最小为准，倾向整段移除）；
- `Footer.tsx` / `lib/content`：`site.links` 新增 `secretRoom: "https://sumire.icu"`，Footer links 数组末尾追加「小密室」；
- **风险点**：「小密室」导航项的既有单测（nav-bar.test.tsx 外链用例组，2026-09-13 引入）需要同步改为 Footer 断言——属接口变更的正常测试更新，不改其余导航用例。

#### 实现点 5: Spec 同步（实现 PR 内）

- `docs/product/spec/site-pages.md`：新增 `/recordings` 页现态；导航项清单更新（+录播 −小密室）；Footer 外链 +小密室；
- `docs/engineering/spec/frontend-bookstore.md`：录播 feature 模块、mpegts.js 依赖、NavBar/Footer 模型；
- `docs/engineering/spec/backend-live.md`：录播代理端点、缓存键与 TTL、降级语义；
- `AGENTS.md` 契约清单补充 `live-recordings.openapi.yaml`。

## 6. 技术决策

### 6.1 决策列表

| 决策 | 选项 A | 选项 B | 最终选择 | 原因 |
|------|--------|--------|---------|------|
| 前端取数路径 | servers/api 代理 | 浏览器直连外网上游 | A | 上游实测无 CORS（OPTIONS 405、无 ACAO），直连不可行；代理契合既有 live-status/live-history 模式 |
| 媒体传输 | 流式 pipe 透传 | 整文件缓冲后转发 / 重签名 URL | A | 单文件数 GB，缓冲不可行；上游无签名 URL 能力 |
| FLV 播放 | mpegts.js（MSE） | 原生 `<video>` / 自研 demux | A | 浏览器不原生支持 FLV；mpegts.js 是 flv.js 的维护 fork，成熟且轻 |
| 录播列表交互 | 按直播间折叠展开 | 穿透进入子路由 | A | PRD 允许二选一；折叠展开无需路由跳转、状态保留简单，房间数少（实测 4 个）无需独立页面 |
| 分页 | 前端分页（pageSize=20） | 服务端分页 | A | 上游无分页参数；单房间文件量级有限，前端 slice 即可 |
| 状态刷新 | 30s 客户端轮询 | SSE / WebSocket | A | 上游无推送能力；对齐站内 LiveStatus 的轻量轮询语义（加可见性暂停） |
| 小密室迁移 | Footer links 数据加 `secretRoom` | Footer 内硬编码 | A | Footer 外链以 `lib/content` 的 `site.links` 为单一事实源，遵循既有结构 |
| 录播导航门控 | `API_CONFIGURED` 门控 | 恒显示 | A | 数据依赖本站 API；与「日历」「棉花糖」先例一致，未配置时不渲染 |

### 6.2 依赖与约束

| 类型 | 内容 | 说明 |
|------|------|------|
| 依赖 | 录播服务内/外网可用，API 形态稳定 | 契约按 2026-09-14 实测结构编写 |
| 依赖 | 新增 `mpegts.js` npm 依赖 | 仅此一个新增运行时依赖 |
| 约束 | 上游无 CORS、无 Range（实测 416） | 代理必须补 CORS；播放按顺序流设计，Range 实现期复验 |
| 约束 | TDD；`pnpm lint && pnpm test` 全绿 | 先测试后实现 |
| 约束 | 契约式开发 | 先落 `contract/live-recordings.openapi.yaml` 再写实现 |
| 约束 | 分支 `<type>/<slug>`；禁 rebase/squash | `prd/recordings-page` → 合入 main 后切 `feat/recordings-page` |

## 7. 项目结构

```
contract/
└── live-recordings.openapi.yaml          # 新增：四个代理端点契约
servers/api/
└── src/
    ├── config.ts                         # 录播上游基址 env
    ├── app.ts                            # 挂载 liveRecordings 路由
    └── routes/
        └── liveRecordings.ts             # 新增：状态/列表代理 + 媒体流式透传
apps/bookstore/
├── app/(site)/(content)/recordings/
│   └── page.tsx                          # 新增：页面壳
├── features/recordings/
│   ├── api.ts                            # 请求封装（降级语义）
│   ├── RecordingStatusList.tsx           # F2 + F3
│   ├── RoomRecordingsGroup.tsx           # F4 折叠 + 前端分页
│   └── FlvPlayerPanel.tsx                # F5 预览/下载 + MSE 降级提示
├── components/NavBar.tsx                 # +「录播」门控项 −「小密室」外链
├── components/Footer.tsx                 # +「小密室」外链
├── lib/content                           # site.links + secretRoom
└── tests/unit/                           # recordings 组件用例 + nav-bar/footer 用例更新
tests/api/                                # live-recordings 黑盒（stub 上游）
tests/e2e/src/bookstore/recordings.spec.ts  # page.route mock 对齐 calendar.spec.ts
infra/aspire/apphost.cs                   # 注入录播上游 env（如现有上游 env 模式）
docs/product/spec/site-pages.md           # 实现 PR 内同步
docs/engineering/spec/{frontend-bookstore,backend-live}.md  # 实现 PR 内同步
```

## 8. 测试策略

### 8.1 测试覆盖要求

- **API 黑盒（tests/api）**：四个端点的 200/降级/参数校验（roomId 非数字 400、fileName 路径穿越 400）；媒体端点断言流式透传（stub 上游分块输出，断言首字节早到、`no-store`、Content-Disposition 透传）；上游 5xx 时元数据端点降级 200。
- **前端单测（Vitest）**：`api.ts` 降级语义；状态列表渲染与轮询（fake timers + visibilitychange）；折叠分组展开拉取一次、分页不重复请求；播放区在 `isSupported()=false` 时的降级 UI（mock mpegts.js）；NavBar「录播」门控与选中态、无「小密室」；Footer 含「小密室」属性断言。
- **e2e（Playwright）**：`page.route` 拦截四个 API 路径返回夹具（对齐 `calendar.spec.ts` 的 mock 模式）：页面渲染、导航跳转、折叠展开与分页、下载链接 href；真实媒体播放不在 e2e 断言（流式媒体在 e2e 不稳定），以「player 初始化被调用」的桩断言替代。

### 8.2 测试类型

| 类型 | 工具 | 覆盖范围 |
|------|------|---------|
| 单元测试 | Vitest + Testing Library | 组件交互、降级、门控、导航/Footer |
| API 测试 | Vitest + fetch（tests/api） | 代理契约、降级、流式透传、参数校验 |
| e2e | Playwright | 页面骨架、导航、列表交互（mock API） |

## 9. 部署方案

### 9.1 环境规划

| 环境 | 用途 | 部署方式 |
|------|------|---------|
| 本地联调 | Aspire 编排（既有四资源） | apphost 注入录播上游 env（缺省 `http://vtuber.internal.fffdan.com`），端点经 `aspire describe` 注入测试 |
| 生产 | bookstore SSG + servers/api（既有） | API 服务 env 指向内网上游；无新增基础设施资源 |

### 9.2 配置管理

- `servers/api`：新增录播上游基址 env（命名对齐现有上游配置，如 `RECORDINGS_UPSTREAM_BASE_URL`，缺省内网地址）；复用既有 Redis；
- `apps/bookstore`：复用 `NEXT_PUBLIC_API_BASE_URL`，无新增前端 env。

## 10. 验收标准

- [ ] 技术方案评审通过
- [ ] `contract/live-recordings.openapi.yaml` 落库且与实现一致
- [ ] 四个代理端点行为符合契约（含降级、流式透传、参数校验），API 测试全绿
- [ ] `/recordings` 页面满足 PRD F1–F5 全部验收标准（含轮询、单例播放、折叠分页、预览/下载、MSE 降级提示）
- [ ] 导航 +「录播」−「小密室」、Footer +「小密室」，既有导航零回归
- [ ] `pnpm lint && pnpm test` 全绿；e2e 录播 spec 通过
- [ ] Spec 同步：`site-pages.md`、`frontend-bookstore.md`、`backend-live.md`、根 `AGENTS.md` 契约清单

## 11. 相关文档

- 关联 PRD：`docs/product/requirements/draft/2026-09-14-recordings-page-prd.md`
- 站点页面 Spec（现态）：`docs/product/spec/site-pages.md`
- 前端 Spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 后端 Spec（现态）：`docs/engineering/spec/backend-live.md`
- 开发规范：`docs/engineering/frontend-rules.md`、`docs/engineering/backend-rules.md`
- 页面设计：`docs/design/02-page-design.md`
