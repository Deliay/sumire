# 棉花糖（提问箱）Spec

棉花糖是面向粉丝的匿名提问/留言功能，主播可在后台管理主题、审阅留言、选择采用。

## 功能概述

- **后台管理**（`/backdoor/topics`）：admin+ 角色可创建/编辑/归档主题，管理棉花糖（采用/忽略 AI 过滤），启动幻灯片放映。
- **公开收集页**（`/topics?id={topicId}`）：粉丝通过分享链接投递棉花糖，支持 Markdown 格式。
- **公开「进行中的棉花糖」页**（`/topics`）：游客浏览进行中的主题并前往投递，顶部导航栏设「棉花糖」入口。
- **AI 审核**：可选启用，投递内容经 AI 自动审核，过滤有害内容。

## 主题管理

### 状态模型

主题有三种派生状态（不落库，由 `deriveStatus` 纯函数计算）：

| 状态 | 条件 | 可投递 |
|------|------|--------|
| `upcoming` | `now < startAt` | 否 |
| `collecting` | `startAt ≤ now ≤ endAt` 且未停止、未归档 | 是 |
| `ended` | `now > endAt` 或已停止、已归档 | 否 |

### 管理端点

| 端点 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/api/topics` | GET | admin+ | 主题列表（默认不含归档） |
| `/api/topics` | POST | admin+ | 新建主题（五字段必填） |
| `/api/topics/:id` | GET | admin+ | 主题详情（含派生 status） |
| `/api/topics/:id` | PUT | admin+ | 编辑主题 |
| `/api/topics/:id/collecting` | POST | admin+ | 开始/停止收集 |
| `/api/topics/:id/archive` | POST | admin+ | 归档主题 |
| `/api/topics/:id/restore` | POST | admin+ | 恢复已归档主题（未归档 409；恢复后 status 按起止时间与 collectingStopped 重新推导） |
| `/api/topics/:id/marshmallows` | GET | admin+ | 棉花糖列表（分页） |
| `/api/marshmallows/:id` | PATCH | admin+ | 采用/忽略 AI 过滤 |

### 公开端点

| 端点 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/api/topics/public` | GET | 无 | 进行中的主题列表（仅未归档且 status=collecting，按创建时间倒序，不含审核字段） |
| `/api/topics/:id/public` | GET | 无 | 主题公开信息（不含审核字段） |
| `/api/topics/:id/marshmallows` | POST | 无 | 投递棉花糖 |

## 棉花糖投递

### 流程

1. 访客访问收集页，服务端颁发 `sumire_vid` HttpOnly Cookie（首次访问）
2. 填写内容（Markdown），点击投递
3. 确认弹窗提示 AI 审核告知
4. 三维度限速检查：clientKey（localStorage）+ visitorId（Cookie）+ IP
5. 落库，若启用 AI 审核则入队
6. 返回 `{ ok: true }`（不含 id/aiReview 等内部字段）

### 限速规则

- 每个维度：1 条/分钟，5 条/小时
- 三维度独立计数，任一超限返回 429

### AI 审核

- 启用时：投递后 `aiReview.status = "pending"`，异步审核
- 审核结果：`approved`（通过）或 `rejected`（拒绝，含原因）
- 管理员可「显示这条棉花糖」（设置 `ignoredByAdmin = true`）
- 未启用时：`aiReview = null`
- 审核模型可通过环境变量 `SUMIRE_REVIEW_AI_MODEL` 指定（可选），不设置时回退 openai→`gpt-4o-mini`、claude→`claude-3-haiku-20240307`

## 后台页面

### 主题列表页（`/backdoor/topics`）

- 页头含视图切换：「主题」（默认，不含归档）/「已归档主题」
- 卡片栅格展示主题（标题 + 状态徽标）
- 操作：停止/继续收集、归档、修改（打开编辑弹窗）
- 新建主题弹窗
- **已归档主题视图**：展示已归档主题列表；卡片操作仅「恢复」（confirm 后调 restore 端点，成功后该主题回到「主题」列表）与进入详情；不提供停止/继续收集与修改

### 主题详情页（`/backdoor/topics/detail?id={topicId}`）

- 查询串方案（与公开收集页一致，GitHub Pages 静态导出兼容动态路由）
- 可折叠描述（Markdown，默认折叠）
- 棉花糖列表：内容默认折叠最多 5 行，超限时底部渐变层「点击查看全文」打开全文弹窗（内部滚动、最高 75vh，弹窗内可采用/取消采用）；AI 覆盖层三态为不透明覆盖（不透出底下内容）
- 工具栏：分享、幻灯片、开始/结束收集、修改主题
- **分享**：弹窗展示投递链接（`${origin}/topics?id={topicId}`，可复制）+ 二维码图片 + 下载 PNG（文件名 `投递二维码-{sanitize(主题)}.png`）
- **已归档主题为只读**：可进入详情页浏览棉花糖（折叠/全文弹窗保留）、可进入幻灯片查看；但不提供修改主题、开始/结束收集、采用/取消采用与「显示这条棉花糖」等一切写操作入口

### 幻灯片页（`/backdoor/topics/presentation?id={topicId}`）

- 查询串方案，独立页，不经后台骨架
- **单行页头**：左起标题（衬线，过长省略）+ 紧随单行纯文本描述（`max-w-[25%]` 省略）；右侧「字体」label + 字号预设档位（小14/中16/大20）
- 页头与放映区以明线（`border-t border-vine`）分割
- 仅展示已采用的棉花糖，条目 `max-w-[50%]` 居中、文本左对齐
- 左右翻页，字号调节（localStorage 持久化）
- 首次引导遮盖层

## 公开收集页（`/topics?id={topicId}`）

- 查询串方案（GitHub Pages 静态导出兼容）
- 三态视图：form / submitting / done
- done 态展示成功提示 + 「查看进行中的棉花糖」链接（跳 `/topics` 进行中列表页），不含审核字段，不提供「再投一条」

## 公开「进行中的棉花糖」页（`/topics`，无 `id` 查询串）

- 与收集页同路由：无 `id` 查询串时渲染进行中主题列表，有 `id` 时为收集页
- 面向游客展示进行中（collecting、未归档）的棉花糖主题列表，数据来自 `GET /api/topics/public`
- 列表项：标题 + 描述（折叠截断）+ 起止时间；点击进入 `/topics?id={topicId}` 投递
- 顶部导航栏提供「棉花糖」入口跳转本页；导航栏 `fixed` 固定于视口顶部，不随页面滑动；仅 API 已配置（`API_CONFIGURED`）时显示该入口
