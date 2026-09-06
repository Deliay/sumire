# 棉花糖（提问箱）Spec

棉花糖是面向粉丝的匿名提问/留言功能，主播可在后台管理主题、审阅留言、选择采用。

## 功能概述

- **后台管理**（`/backdoor/topics`）：admin+ 角色可创建/编辑/归档主题，管理棉花糖（采用/忽略 AI 过滤），启动幻灯片放映。
- **公开收集页**（`/topics?id={topicId}`）：粉丝通过分享链接投递棉花糖，支持 Markdown 格式。
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
| `/api/topics/:id/marshmallows` | GET | admin+ | 棉花糖列表（分页） |
| `/api/marshmallows/:id` | PATCH | admin+ | 采用/忽略 AI 过滤 |

### 公开端点

| 端点 | 方法 | 权限 | 说明 |
|------|------|------|------|
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

## 后台页面

### 主题列表页（`/backdoor/topics`）

- 卡片栅格展示主题（标题 + 状态徽标）
- 操作：停止/继续收集、归档、修改（打开编辑弹窗）
- 新建主题弹窗

### 主题详情页（`/backdoor/topics/detail?id={topicId}`）

- 查询串方案（与公开收集页一致，GitHub Pages 静态导出兼容动态路由）
- 可折叠描述（Markdown，默认折叠）
- 棉花糖列表（采用/取消采用，AI 覆盖层三态）
- 工具栏：幻灯片、开始/结束收集、修改主题

### 幻灯片页（`/backdoor/topics/presentation?id={topicId}`）

- 查询串方案，独立页，不经后台骨架
- 仅展示已采用的棉花糖
- 左右翻页，字号调节（localStorage 持久化）
- 首次引导遮盖层

## 公开收集页（`/topics?id={topicId}`）

- 查询串方案（GitHub Pages 静态导出兼容）
- 三态视图：form / submitting / done
- done 态仅展示成功提示，不含审核字段
