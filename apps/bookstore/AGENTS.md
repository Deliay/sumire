# apps/bookstore

枝堇Sumire 粉丝站前端——Next.js（App Router）全静态（SSG）+ 后台 `/backdoor` 路由区（客户端会话/权限守卫）。

开发前加载 `docs/engineering/frontend-rules.md`、`docs/design/03-backdoor-design.md` 与 `docs/engineering/backend-rules.md`（后台页面依赖的 API 契约见 `contract/backdoor-auth.openapi.yaml`；直播计划契约见 `contract/stream-plans.openapi.yaml`）。

## 技术栈

- Next.js（App Router）+ React + TypeScript（strict），全部静态生成（SSG）
- Tailwind CSS v4，token 定义于 `app/globals.css` 的 `@theme`
- 内容：仓库内 YAML + Zod 校验（`lib/content/`）
- 测试：Vitest（单元）+ Playwright（E2E）

## 常用命令

```bash
pnpm dev          # 本地开发
pnpm build        # 生成缩略图 + 生产构建
pnpm test         # 单元测试
pnpm test:e2e     # E2E 测试
pnpm lint         # ESLint
```

## 目录

| 目录 | 职责 |
|------|------|
| `app/` | 路由与页面；`app/backdoor/` 为后台路由区 |
| `features/backdoor/` | 后台会话守卫、权限守卫、API 调用、后台组件 |
| `features/<模块>/` | 页面/工具业务组件 |
| `components/` | 设计系统组件 |
| `lib/` | 内容加载与工具 |
| `content/` | 站点数据 YAML |
| `public/assets/` | 素材原图与缩略图 |
| `tests/` | 单元测试 |

## 后台 /backdoor 约定

- 保持 SSG，会话/权限守卫在客户端；`features/backdoor/session.tsx` 的 `SessionProvider` 负责会话守卫与强制改密引导，`RequireRole` 负责权限守卫；
- 构建时守卫：`app/backdoor/layout.tsx` 读取 `api.ts` 导出的 `API_CONFIGURED`（`NEXT_PUBLIC_API_BASE_URL` 非空即已配置），未配置时直接渲染 `components/NotFoundPage` 站点风格 404（`SessionProvider` 不进入组件树）；`api.ts` 的 `request()` 亦在未配置时短路不 `fetch`，双保险杜绝发往主站自身的 `/api/*` 请求；
- API 调用统一走 `features/backdoor/api.ts`，`fetch(..., { credentials: "include" })`，base URL 取 `NEXT_PUBLIC_API_BASE_URL`；
- 视觉严格按 `docs/design/03-backdoor-design.md`：仅用 `@theme` token 色，后台不使用氛围动效，控件过渡 ≤200ms 且尊重 `prefers-reduced-motion`；
- 不出现注册/找回密码入口，不出现未上线功能占位。

## 周表 / 直播计划约定

- `features/schedule/`：直播计划业务组件——`CalendarView`（可复用月视图日历，周一开头，纯 `YYYY-MM-DD` 字符串比较规避时区；有计划日期展示至多 2 条 `HH:mm 主题` 摘要，更多以 +N 收尾；`onSelectDay` 上抛所选日）、`DayDetailDialog`（当日详细安排弹层，`readOnly` 切换只读/管理双模式，管理态含行内编辑/删除二次确认与「+ 增加计划」）、`PlanFormDialog`（录入/编辑双态表单，父组件变更 key 重置初始值）、`DatePicker`/`TimePicker`（定制选择器，只读输入 + 浮层，键入容错经 `dateUtils.parseTimeStr`/`parseDateStr`）、`api.ts`（`listPlans`/`createPlan`/`updatePlan`/`deletePlan`，复用 `features/backdoor/api.ts` 的 `API_BASE_URL`/`API_CONFIGURED` 口径）、`dateUtils.ts`（日历网格与时间解析纯函数）、`useDismiss.ts`（浮层点击外部/Esc 收起）、`CalendarViewPage`（公开日历页主体，接只读 `DayDetailDialog`）；
- 公开日历页 `app/(site)/calendar/page.tsx`：构建时守卫，未配置 `NEXT_PUBLIC_API_BASE_URL` 直接渲染 `components/NotFoundPage`（不加载日历 chunk、不发请求），已配置时渲染 `CalendarViewPage`；
- 后台直播计划页 `app/backdoor/(dashboard)/schedule/page.tsx`：复用 `(dashboard)/layout.tsx` 会话守卫；日历点击某天弹管理态 `DayDetailDialog`（member 只读降级，与后端 403 口径一致）；弹层内增加（日期预填所选日）/编辑（可改期）/删除（二次确认）后重拉当前月区间，编辑移出所选日提示「已移至 X 月 X 日」；
- 主页入口 `features/home/WeeklySchedule.tsx`：仅 `API_CONFIGURED` 时由 `app/(site)/page.tsx` 挂载（未配置不留占位）；初始渲染固定最小高度加载骨架，避免 hydration 布局跳动；缎条为 `MON. + HH:mm 主题`（**不混入**历史直播记录，保持一期语义）；
- 日历混合展示（二期）：`CalendarView` / `DayDetailDialog` 的数据入口为统一条目 `CalendarEntry`（`kind: "plan" | "history"`，由 `mergeEntries(plans, records, now)` 归一化合并——历史记录 `startDate` 按访客本地时区折算 `date`/`startTime`、跨天归开播当日、缺 `title`/`startDate` 丢弃、未来记录不纳入）；历史条目在格子以藤蔓点 + 弱化样式区分来源、恒为「已播出」，在当日弹层带「实际播出」标签并附结束时刻、任何角色只读（无编辑/删除）；计划与历史两路独立加载，历史失败静默降级仅展示计划；
- 历史直播取数：`api.ts` 新增 `LiveRecord` 类型与 `listLiveHistory()`（`API_CONFIGURED` 为假或请求失败返回 `{ ok: false, records: [] }`）；上游地址收敛在 `servers/api` 服务端（`LIVE_HISTORY_UPSTREAM_URL`），不进前端 bundle；
- 周表图片生成：`features/schedule/weeklyImage/`——`weekUtils.ts`（ISO-8601 周计算纯函数，周一为一周首日）、`layout.ts`（绘制布局纯函数，注入 `measure` 做 shrink-to-fit + 截断）、`renderer.ts`（底图/字体并行预加载 + Canvas 绘制 + PNG dataURL）、`WeeklyImageDialog.tsx`（周切换器 + 预览 `<img>` + 长按/右键保存提示；打开时一次性 `listPlans` 拉全量，切换周只重跑布局 + 重绘）；后台「直播计划」页新增「生成周表图片」按钮（所有登录角色可用，只读性质）；只渲染人工计划，不渲染历史记录；
- 素材坐标：`public/assets/original/AGENTS.md`（`weekly-schedules-raw.jpg` 1665×1080，每日区域 715×70，左上角 x=365，y=278/379/480/580/681/782/883）；底图须随站点同源分发（跨域 CDN 会污染画布导致 `toDataURL` 抛错）。

提交前 `pnpm lint && pnpm test && pnpm build` 全绿。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
