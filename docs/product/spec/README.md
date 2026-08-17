# 产品 Spec 索引

产品 spec 描述系统**当前**的用户可见行为，是产品功能的单一事实源。与 `requirements/` 下的 PRD 不同：PRD 是时点文档（提出时的需求），spec 是持续维护的现态文档。

## 模块索引

| Spec | 模块 |
|---|---|
| [site-pages.md](site-pages.md) | 公开站页面：首页、档案页、素材页、全局导航与降级规则 |
| [calendar.md](calendar.md) | 公开日历页与首页「本周日程」区块 |
| [backdoor.md](backdoor.md) | 后台鉴权与用户管理（登录、强制改密、用户管理、仪表盘） |
| [schedule-admin.md](schedule-admin.md) | 直播计划管理与周表图生成 |
| [danmaku.md](danmaku.md) | 弹幕后台（信息流、已读管理、栏位布局） |

## 维护规范

- 功能行为发生变更（新增、修改、下线）时，**同一个 PR 内必须同步更新对应 spec**；spec 不描述未上线功能。
- 未上线的功能不得在 UI 中显示占位入口，也不得出现在 spec 中。
- spec 按模块组织，一个模块一个文件；模块拆分时相应拆分文件并更新本索引。
- spec 只描述「现在是什么」，不记录历史决策理由（决策留在已归档的 PRD/proposal 中）。
