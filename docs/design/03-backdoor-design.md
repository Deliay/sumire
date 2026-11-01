---
description: 后台 /backdoor 视觉现态——共享 token、基础控件与壳层；工作台口径（去装饰、强焦点、密而有序），不重排业务布局
type: Permanent
---

# 后台设计（/backdoor）

后台是工作台：去装饰、强焦点、密而有序。**只统一 token、基础控件与壳层，不重排业务页面信息架构，不改权限、会话、请求、分页、筛选、已读、SSE 与弹幕看板交互。**

## 1. Token 与基础控件

- 与公开站共用 `app/globals.css` 的 `@theme`：`night / raised / soft / line / line-strong / ink / ink-dim / ink-mute / primary / flower / eye / crimson / gold`；圆角 `2 / 4 / 8 / 999`；控件过渡 140ms。
- `features/backdoor/components/TextField.tsx`：soft 面、1px `line-strong`、8px 圆角、44px 高；聚焦 1px `flower` + 2px `flower/20` 环。
- `PrimaryButton`：薄封装共享 `Button variant="primary"`，整宽。
- 弹层：`rounded-md`、`border-line`、`bg-raised`、`shadow-overlay`；错误文案 `crimson` 且 `role="alert"`。
- `RoleBadge`：方形 4px 圆角、按层级描边色。
- `RoleSelect`：按权限限定选项；选中 `primary` 描边。

## 2. 壳层

- `TopBar`：56px、`raised` 底、底部 1px `line`；右侧用户名 / 角色为 `font-mono text-label`。
- `SideNav`：桌面 200px、右侧 1px `line`；活动态 `soft` 底 + 左 2px `primary`；删除装饰线。
- `LoginCard` / `ChangePasswordCard`：`raised` 面 + 顶部 1px `primary` 线、`border-line`、无阴影；`TextField` + `PrimaryButton`。
- `GuardLoading`：1px 旋转环，reduced-motion 下静态。
- 仪表盘：去除藤蔓分隔线，改用 1px `Rule`。

## 3. 表格与列表

用户管理 / 弹幕检索 / 直播计划：

- 表头 `text-label` + `ink-dim`；行 `border-b border-line`；hover `bg-soft/60`；危险操作 `text-crimson`。
- 保留现有列、操作与分页；不新增/删除功能入口。

## 4. 弹幕看板 / 工具

- 语义色继续使用 `eye`（直播/舰长）、`crimson`（总督/危险）、`gold`（提督/礼物），只换 token 不改逻辑。
- 弹幕时间、在线人数、日历刻度等元数据使用 `font-mono`。
- 后台不使用氛围动效，严格执行 `prefers-reduced-motion`（全局兜底块已覆盖）。

## 5. 明确不做

- 不画公开站装订线、不用竖排书名；
- 不重排业务页面布局；
- 不引入新依赖或新交互模式。
