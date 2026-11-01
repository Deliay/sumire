# 直播日历 Spec

日历页 `/calendar` 与首页日历站共用 `features/schedule/CalendarView`；后台直播计划页 `/backdoor/schedule` 使用 `variant="panel"`，公开页使用 `variant="immersive"`。

## 数据与取数

- 条目统一为 `CalendarEntry`（`kind: "plan" | "history"`），由 `mergeEntries(plans, records, now)` 归一化合并：历史记录 `startDate` 按访客本地时区折算 `date` / `startTime`、跨天归开播当日、缺 `title` / `startDate` 丢弃、未来记录不纳入。
- 计划与历史两路独立加载；历史失败静默降级仅展示计划。
- 月视图按展示网格首格~末格取数（`monthGridRange`），周视图按周一~周日取数；翻月 / 翻周经 `onRangeChange(from, to)` 重新拉取。
- 历史条目以弱化样式展示、恒为「已播出」，当日弹层带「实际播出」标签并附结束时刻，任何角色只读。

## 公开页布局

- `/calendar`：`PageShell width="wide"` + `PageHeader`（eyebrow `Weekly Schedule`、folio 柒、标题「直播日程」、引文）。
- 未配置 `NEXT_PUBLIC_API_BASE_URL`：构建时守卫直接渲染站点 404，不加载日历 chunk、不发请求。
- 首页日历站为全幅 immersive 月视图，`compact` 模式不渲染页头。

## 月视图

- 周一开头，7 列 × 6 行；网格与单元格统一 1px `line` 分隔，单元格无圆角、无底色。
- 今天：`primary` 圆点 + `primary` 日期；过去日期弱化；计划摘要 `HH:mm 主题`（时间 `font-mono`），每格至多 2 条，超出以 `+N` 收尾；历史条目弱化并以 `line-strong` 圆点区分来源。
- 翻月：44×44 `ghost` 图标按钮（`aria-label="上一月"` / `"下一月"`），置于内容两侧 gutter，仅图标；不产生横向滚动。
- immersive 支持横向拖拽翻月（阈值 60px；拖拽超阈值后抑制本次日期点击）；点击日期弹出只读当日详情（`DayDetailDialog`，portal 到 `body`）。
- 星期标签 `font-mono text-label`。

## 周视图（<640px）

单周 7 天纵向列表 + 周切换（上一周 / 下一周 / 今天）；每日至多 4 条摘要；今天 `primary` 圆点。断点跨越不丢选中日期。

## 后台

- `variant="panel"` 保持现有布局与控件，仅继承新 token / 描边 / 焦点环。
- 管理态当日弹层支持行内编辑、删除（二次确认）、新增；编辑移出所选日时提示「已移至 X 月 X 日」；member 只读降级。

## 周表图片

后台「直播计划」页的「生成周表图片」仍为只读工具：ISO-8601 周计算、Canvas 2× 离屏超采样、1665×1080 PNG；只渲染人工计划，不渲染历史记录。
