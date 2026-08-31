# 测试 Spec

## tests/api — 黑盒 API 契约测试

Vitest + Node fetch + 手工 `CookieJar`。纯契约驱动：禁止对照 `servers/` 实现编写，仅依据 `contract/*.openapi.yaml` 与 PRD。

- `src/client.ts`：fetch 封装、`CookieJar`（解析/回带 `sumire_sid`）、`login`/`asSuperadmin`/`createRoleAccount` 助手、`waitForReady` 就绪轮询（GET `/api/auth/me` 返回 401 即就绪）；`API_BASE_URL` 必需，`BOOKSTORE_ORIGIN` 仅 CORS 用例用。
- `vitest.config.ts`：`fileParallelism: false` 全局串行（限速用例有全局副作用），`testTimeout: 30000`。
- 基态：种子超管 `supersumire`/`salamander` 不改密；临时用户名带随机后缀（`t_<uuid8>`）；`REDIS_URL` 用于用例间清理缓存。

覆盖（11 个 spec）：login（Cookie 属性精确断言、防枚举 401、契约外路由 404）、logout（幂等）、session（me、伪造 sid 401、TTL 滑动、多会话隔离）、change-password（旧密码失效、强度策略）、users（权限矩阵、409、强制改密闭环）、stream-plans（公开读、admin 写矩阵、判重、ObjectId/404）、live-history（stub 上游 9876：三字段裁剪、倒序 100、缓存命中、降级永不 5xx）、live-status（stub 上游 9878：公开读、live 布尔归一化、缓存命中、超时/非法/结构非法降级永不 5xx）、live-events（stub 上游 9877 含 SSE：鉴权矩阵、分页信封、read/unread 幂等交叉、read-all 水位线只前进、`watermark:*` 前缀拒 400、SSE 心跳 30s）、surface（纯 API 面、CORS 精确白名单 + credentials）、zz-rate-limit（文件名 `zz-` 前缀保证最后执行：5 次/分/IP 第 6 次 429）。

## tests/e2e — Playwright

只测 bookstore 前端（公开页 + `/backdoor`），接口行为不重复 tests/api。服务全由 Aspire 管理，`playwright.config.ts` 不用 `webServer`，`baseURL` 取 `BOOKSTORE_BASE_URL`。

- `global-setup.ts`：通过 API 造三角色已完成改密的账号（用户名带时间戳后缀，种子超管仅用于建号），写入 `.accounts.json`。
- 覆盖：backdoor auth（未登录跳转、reload 保持会话、错误提示、登出闭环）、change-password（强制改密闭环、弱密码拒绝）、users（超管列表+建号、其余角色引导回仪表盘、按角色导航）、dashboard（布局与视觉冒烟）、schedule（CRUD 闭环、member 只读、周表图弹层、移动端周视图）、danmaku（三栏渲染+SSE、滚动锚定、双击已读、read-all 二次确认、member 无已读交互、localStorage 持久化）、unconfigured（未配置形态 404 且不发 /api 请求）、calendar（公开读、计划+历史混合 mock、历史失败静默降级、移动端周视图）、footer-link（公开站无 /backdoor 链接）、site（主页一屏无滚动、文案块与 bio、无入口卡/速览条/本周日程、footer 三外链、直播状态与今日日程组件存在性、/about 新字段、/calendar 回归）。
- 未配置形态独立运行：`playwright.unconfigured.config.ts` + `scripts/serve-static.mjs` 静态伺服 `apps/bookstore/out`，`pnpm test:unconfigured`。

## 端点注入

测试端点经 `aspire describe <resource> --output json` 取 http endpoint 后注入 `API_BASE_URL` / `BOOKSTORE_BASE_URL` / `BOOKSTORE_ORIGIN` / `REDIS_URL`。
