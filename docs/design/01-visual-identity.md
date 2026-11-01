---
description: 堇色书屋视觉识别现态——装订（The Binding）设计语言：深墨底、暖骨白文字、堇色单点强调、1px 结构线、编辑体排版；色板/字阶/版心/圆角/描边/动效/组件规范
type: Permanent
---

# 视觉识别：装订（The Binding）

把站点当作一本关于枝堇的书来排版：有装订线、页码、图版与版权页。结构先于装饰，版面即氛围。设计 token 定义于 `apps/bookstore/app/globals.css` 的 `@theme`，组件见 `apps/bookstore/components/`。

## 1. 六条原则

1. 结构先于装饰：层级由字阶、留白、1px 描边建立，不画无结构含义的图形。
2. 版面即氛围：氛围来自暖骨白文字、深墨底、宋体标题与大面积留白。
3. 一色点睛：堇色 `#b4a6bf` 是唯一品牌强调色；`flower` 仅用于焦点、链接与直播状态。
4. 阅读轴稳定：同类内容位置固定（档案五屏文字恒左、图版恒右）。
5. 动效服务阅读：仅保留入场、悬停、翻页；无环境循环动效。
6. 可用性基线：正文对比度 ≥4.5:1、焦点可见、触摸目标 ≥44×44、键盘可达。

## 2. 色彩

| Token | 色值 | 用途 |
|-------|------|------|
| `--color-night` | `#141017` | 页面底色（墨） |
| `--color-raised` | `#1b1620` | 抬升面：卡片、导航、弹层内容 |
| `--color-soft` | `#262029` | hover / 选中 / 输入面 |
| `--color-line` | `#3a323d` | 1px 结构线、分隔线、卡片描边 |
| `--color-line-strong` | `#75687e` | 强调描边、图版边框、控件边界 |
| `--color-ink` | `#e9e2dc` | 主文字（暖骨白） |
| `--color-ink-dim` | `#a298a2` | 次级文字、说明 |
| `--color-ink-mute` | `#776d78` | 仅禁用态 / 大号装饰文字（不可用于小号正文） |
| `--color-ink-on-paper` | `#2a232b` | 反白图版上的文字 |
| `--color-paper` | `#efe9e4` | 极少数反白面（引用 / 海报式图版） |
| `--color-paper-dim` | `#d7cfc9` | 反白面次级元素 |
| `--color-primary` | `#b4a6bf` | 应援色：页码、活动态、关键图形 |
| `--color-primary-deep` | `#8f7d9e` | 主色加深：hover / 次级强调 |
| `--color-flower` | `#a184c9` | 焦点环、链接、直播状态点 |
| `--color-eye` | `#7fb0e6` | 功能语义：直播中 / 舰长等级 |
| `--color-crimson` | `#e06a7a` | 功能语义：危险 / 总督 |
| `--color-gold` | `#d8b25c` | 功能语义：礼物 / 提督 |

规则：只允许 `@theme` token，不写十六进制；`vine` 已删除；功能语义色只用于弹幕看板、直播状态等有语义位置；反白面只用于引用 / 海报式图版。

## 3. 字体与字阶

| 角色 | Token | 用途 |
|------|-------|------|
| 宋体 | `--font-serif` | 页面标题、章节标题、长文、书名 |
| 黑体 | `--font-sans` | 导航、按钮、表单、表格 |
| Cormorant | `--font-display` | 仅 `Sumire` 字标、图版编号、卷次大字 |
| 等宽 | `--font-mono` | 日期、时间、尺寸、分类、文件大小 |

字阶：`--text-display` `clamp(3.5rem, 7vw, 6.5rem)`；`--text-h1` `clamp(2.25rem, 4vw, 3.25rem)`；`--text-h2` `1.75rem`；`--text-h3` `1.25rem`；`--text-body` `1.0625rem`；`--text-small` `0.9375rem`；`--text-label` `0.75rem`（配 `--tracking-label: 0.12em`）；`--text-tiny` `0.8125rem`。中文标题只用 600；正文行高 1.9、界面行高 1.5。

## 4. 网格、版心与节奏

- 断点：`<640px` 移动 / `640–1024px` 平板 / `>1024px` 桌面。
- gutter：移动 `1.25rem` / 平板 `2rem` / 桌面 `4rem`。
- 宽版心 `max-width: 88rem`（素材、日历、录播、档案）；阅读版心 `max-width: 44rem`。
- 装订线：桌面 `≥1024px` 在公开页内容列左侧画 1px `line`（`PageShell` 的 `lg:border-l`），后台不画。
- 栅格：桌面 12 列；档案屏文字 `col-span-6`、图版 `col-span-5`、偏移 1 列。
- 圆角：`--radius-xs` 2px（图版 / 卡片）、`--radius-sm` 4px（标签）、`--radius-md` 8px（输入 / 弹层 / 按钮）、`--radius-pill` 999px（仅状态药丸）。
- 阴影：仅弹层 `--shadow-overlay`；卡片、按钮、导航无阴影。
- 描边：结构线 1px `line`；强调 / 控件边界 1px `line-strong`。

## 5. 图像与图标

- 图版（`Plate`）：1px 描边、无圆角容器；题注 `图版 01 · <标题> · <分类>`；立绘 `object-contain` + `bg-soft` 内衬，其余 `object-cover`；hover 仅 `opacity` 与题注下划线，不上浮、不放大、不泛光。
- 图标统一 Lucide，线宽 1.5，尺寸 16 / 18 / 20，不使用彩色图标。

## 6. 动效

| 场景 | 规格 |
|------|------|
| 入场 | `opacity 0→1` + `translateY(8px→0)`，480ms，`--ease-out-quart`；仅首屏与页面标题 |
| 悬停 / 焦点 | 颜色、描边、透明度，140ms |
| 整页翻页 | 当前屏位移 + 淡出，480ms；reduced-motion 直接落位 |
| 弹层 | 遮罩 opacity，内容 `translateY(8px)`，220ms |
| reduced-motion | 全站尊重：无 translate / scale / 视差 / 粒子；环境动效不存在 |
| 循环动效 | 仅直播状态点 `animate-pulse` |

## 7. 可访问性

正文 / 次级文字对比度 ≥4.5:1；`:focus-visible` 2px `flower` 焦点环 + 2px 外偏移；触摸目标 ≥44×44；导航 `aria-current`、移动抽屉 `dialog` + `aria-modal` + `aria-expanded`，Esc 关闭、焦点陷阱、滚动锁、关闭后焦点归还；公开页提供「跳到正文」skip link；图片 alt 用素材标题，装饰图形 `aria-hidden`；不出现仅 hover 可得的信息。

## 8. 已移除

藤蔓分隔线 / 蕾丝扇贝条 / 纸页角饰 / 发光花节点 / 雾气色块 / 常驻粒子 Canvas / 立绘视差 / 树状圆点索引（`VineDivider`、`LaceFrame`、`PaperCard`、`ExternalButton`、`VineTimeline`、`GlowParticles`、`ParallaxLayer`、`SectionRail` 及对应 CSS）。
