---
description: 全站视觉系统重设计 PRD——以「装订（The Binding）」为概念，把站点当作一本关于枝堇的书来排版：移除自绘藤蔓、蕾丝扇贝条、纸页角饰、发光花节点、雾气色块、常驻粒子与视差等具象装饰，改为装订线、页码、图版题注、版权页式页脚与编辑体排版；统一色板/字阶/间距/圆角/描边/组件状态，重做导航、页脚、按钮、标签、卡片、时间线、位置索引与首页/档案/素材/日历/录播/棉花糖页面框架；保留现有信息架构、路由、整页翻页机制与全部业务功能；后台仅做 token、基础控件与壳层对齐；无后端与契约变更
type: Fleeting
---

# 全站视觉系统重设计：装订（The Binding）

**功能名称**: 全站视觉系统重设计（Visual System Redesign：装订 / The Binding）
**PRD 版本**: v1.0
**创建日期**: 2026-11-01
**作者**: sumire workflow
**状态**: draft（待评审）

---

## 〇、方案速览（TL;DR）

- **一句话**：不画藤蔓，也不画蕾丝——把站点当作一本关于枝堇的书来排版，用装订线、页码、图版题注与版权页替代具象装饰。
- **删什么**：藤蔓分隔线、蕾丝扇贝条、纸页角饰、发光花节点、雾气色块、常驻粒子、立绘视差、树状圆点索引；以及依赖它们的 CSS、组件与测试。
- **加什么**：深墨 + 暖骨白色板、编辑体字阶、`PageShell / PageHeader / SectionHeader`、`Button / Field / Tag / Surface / Notice / Plate / Timeline / Rule / EmptyState`、版权页式页脚、右侧页码索引。
- **页面怎么变**：首页竖排书名 + 图版；档案五屏固定「文字左 / 图版右」；日历去圆角改细线网格；素材改图版网格 + 下划线分类；后台只对齐 token、控件与壳层。
- **不变什么**：文案、IA、路由、整页翻页机制、API 契约、后台业务逻辑与权限。
- **评审先看**：§三（视觉系统）、§四（页面与组件）、§九（6 个待确认决策）。

---

## 一、背景与目标

### 1.1 背景

网站已完成「整页滚动叙事」「档案五屏」「全幅日历」「全幅素材」「录播 / 回放」「棉花糖」等功能建设，功能覆盖已经足够，但视觉层是在多期增量迭代中叠加出来的：

- 每一期都为「氛围」新增一个自绘元素（藤蔓分隔线、蕾丝边、纸页角饰、发光花节点、雾气色块、常驻粒子、视差），这些元素各有各的笔触、尺寸与动画节奏；
- 组件样式缺少统一约束：圆角同时存在 `md / lg / xl / 2xl / full`，阴影从 0 到泛光多种口径，章节标签大量使用同一套「花体斜体 + 宽字距」，全站颜色同时被 `primary / flower / vine / eye` 争夺注意力；
- 页面容器宽度不一致：导航全屏宽、`/about` 限宽 4xl、`/assets` 全幅、页脚限宽 6xl，造成明显的左右边线对不齐；
- 这些装饰被用户直接指出「看起来有象征意义但视觉上很丑」，其中页脚蕾丝扇贝条与手绘藤蔓是明确点名项。

本期不是给现有样式打补丁，而是**重建设计语言**：先定义一套可复用的 token 与基础组件，再按同一套规则重排全部公开页面；现有信息架构（IA）、文案、路由、整页翻页机制与业务功能全部保留。

### 1.2 现状诊断（可复核）

| 位置 | 现状 | 问题 |
|------|------|------|
| `components/Footer.tsx` + `app/globals.css` `.lace-x` | 页脚顶部 14px 高重复扇贝纹 + 圆点 | 与正文没有任何结构关系，像贴纸；在深色背景上形成一条脏边；是用户点名项 |
| `components/VineDivider.tsx` | `viewBox="0 0 1200 64"` + `preserveAspectRatio="none"` 的手绘曲线、3 片叶子、3 个发光圆 | 宽屏下曲线与叶子被横向拉伸变形（`preserveAspectRatio="none"` 的必然结果）；叶片是粗略的二次贝塞尔，像占位图；发光圆糊成一团 |
| `components/LaceFrame.tsx` | 上下两条扇贝纹包裹内容 | 框与内容没有关系，信息层级反而被削弱；移动端挤压首屏空间 |
| `components/PaperCard.tsx` + `.paper` | 浅紫纸面 + 22px 点阵噪点 + 四角 SVG 曲线角饰 | 角饰在不同卡片高度下比例失控；点阵在低 DPI 屏上像脏点；浅色纸卡与深色站点形成硬切，读起来割裂 |
| `features/about/VineTimeline.tsx` + `.flower-node` | `viewBox="0 0 24 1000"` 的波动轴 + 绝对定位的发光圆节点 | 轴体随容器高度被纵向拉伸，节点用固定 `left-3 / md:left-1/2` 定位，和曲线峰值对不上；发光节点边缘发脏；时间线信息反而不如一条直线清楚 |
| `features/home/SectionRail.tsx` | 右侧 `border-l` + 嵌套 `border-l` + 8px/6px 发光圆点 | 视觉上像调试用的文件树，而不像页面索引；无文字标签，发现成本高 |
| `features/home/GlowParticles.tsx` + `.fog` | 70 个 Canvas 粒子 + 2 个 `blur(64px)` 彩色雾气块 | 视觉噪音压过正文；持续重绘耗电；雾气在部分显示器上出现色带 |
| `features/home/parallax.ts` / `ParallaxLayer.tsx` | 指针 + 设备方向传感器驱动的立绘视差 | 与「简洁」目标冲突；移动端有晕动风险；每个档案屏都要额外 12px 出血补丁 |
| 全站 | `font-display` 花体斜体被当成「章节小标签」到处使用 | 装饰性字体承担了信息性职责，中文语境下读起来像注音，降低了专业感 |
| 全站 | `primary / flower / vine / eye` 四色同时用于强调 | 没有主次，视线无处落脚 |
| 全站 | 页面容器宽度、左右 gutter 不统一 | 导航、正文、页脚边线对不齐，是「不好看」最直接的结构性来源 |

### 1.3 设计概念：装订（The Binding）

> 不画藤蔓，也不画蕾丝。把站点当作**一本关于枝堇的书**来排版：有装订线、有页码、有图版、有版权页。

| 书的元素 | 站点对应 | 作用 |
|----------|----------|------|
| 装订线 | 每个公开页/每屏内容列左侧的 1px 竖线（随版心，非固定浮层） | 提供稳定的版心边界与阅读起点，取代藤蔓竖轴 |
| 页码 / 卷次 | 章节 folio（壹/贰/叁…）与 `01 / 08` 形式的小号元数据 | 表达真实顺序（首页 → 档案五节 → 日历 → 素材），不是装饰 |
| 图版 | 立绘 / 插画统一放进无圆角、1px 描边的「图版」，下方带题注（`图版 01 · standing-01`） | 把官方素材当展品呈现，替代发光边框与角饰 |
| 版权页 | 页脚改为三栏版权信息（站点说明 / 导航 / 外链） | 让免责声明与外链有明确归属，替代蕾丝条 |
| 竖排书名 | 首屏「枝堇」在桌面端竖排（`writing-mode: vertical-rl`），移动端横排 | 唯一的高辨识度排版动作，来自中文书籍传统，与「老书屋」主题同源 |

六条设计原则：

1. **结构先于装饰**：层级由字阶、留白、1px 描边建立；不画没有结构含义的图形。
2. **版面即氛围**：氛围来自暖调纸白文字、深墨底、宋体标题与大面积留白，不再来自发光和雾气。
3. **一色点睛**：堇色 `#b4a6bf` 是唯一品牌强调色；`flower` 仅用于焦点、链接与直播状态，单屏面积 ≤5%。
4. **阅读轴稳定**：同一类内容在页面中的位置固定（档案五屏文字恒左、图版恒右），不为了「节奏」左右横跳。
5. **动效服务阅读**：只保留入场、悬停与翻页三种动效；无环境循环动效；尊重 `prefers-reduced-motion`。
6. **可用性基线**：正文对比度 ≥4.5:1、焦点可见、触摸目标 ≥44×44、键盘可达、无 hover-only 信息。

**本期唯一的高风险审美动作**：桌面端首屏竖排书名 + 贯穿全站的装订线。它足够有辨识度，也足够克制；评审若不接受，可退回横排，其余方案不受影响（见 §九）。

### 1.4 目标

- 建立一套**单一事实源**的视觉 token 与基础组件，公开站与后台共用；
- 删除全部被点名的具象装饰，以及依赖它们的 CSS、组件、测试与文档口径；
- 统一全站版心、gutter、区块节奏、圆角、描边、阴影、图标线宽与交互状态；
- 让公开站所有页面在同一套版式规则下呈现，信息层级在 3 秒内可读；
- 保持现有 IA、文案、路由、整页翻页、日历、素材、录播、棉花糖、后台的全部功能不变；
- 可访问性达到 WCAG 2.1 AA（正文对比度、焦点、键盘、触摸目标、reduced-motion）。

### 1.5 成功标准（总览）

- [ ] 评审通过后，全站不再出现藤蔓曲线、蕾丝扇贝条、纸页角饰、发光花节点、雾气色块、常驻粒子、视差等具象装饰；
- [ ] 任意两个公开页面并排看，导航、正文、页脚的左右边线对齐；
- [ ] 同一类组件（按钮、标签、卡片、空态、弹层）在所有页面视觉一致；
- [ ] 首屏在 10 秒内传达「她是谁 / 是否在播 / 今天播什么 / 去哪看」，且正文是第一视觉层级；
- [ ] 键盘可完成全站导航与主要操作；`prefers-reduced-motion` 下无位移动画；
- [ ] `pnpm lint && pnpm test && pnpm build` 全绿，公开站与后台 E2E 关键路径全部通过。

---

## 二、用户分析

### 2.1 目标用户

| 角色 | 描述 | 核心诉求 |
|------|------|----------|
| 新访客 | 从 B 站 / 社交平台点进来，第一次了解枝堇 | 10 秒内知道她是谁、在哪播、有什么内容 |
| 回访粉丝 | 来看日程、素材、录播、棉花糖 | 快速到达目标页，操作路径短，状态清楚 |
| 移动端访客 | 通勤 / 睡前浏览 | 单手可操作、文字不挤、不晕动 |
| 站点维护者 | 主播团队 / 应援组 | 后台信息密度高、控件一致、改动可预期 |
| 无障碍用户 | 键盘、低视力、晕动敏感 | 对比度、焦点、语义、减少动态 |

### 2.2 用户场景与痛点

| 场景 | 现状痛点 | 本期目标 |
|------|----------|----------|
| 首访判断「这是谁」 | 首屏被雾气、粒子、发光装饰分散注意；花体标签抢戏 | 竖排书名 + 一句简介 + 清晰元数据，正文为第一层级 |
| 顺着首页看完档案 | 五屏左右交替，阅读位置每屏跳变；发光节点干扰阅读 | 固定阅读轴，页码提示进度，图版与文字分区明确 |
| 查今天播什么 | 直播状态药丸 + 日程卡 + 免责声明堆在左下，层级不清 | 直播状态与今日日程改为两行「元数据」，用 1px 线分隔 |
| 找素材原图 | 卡片边框、hover 上浮、泛光按钮同时出现 | 图版网格 + 下划线分类 + 全屏 Lightbox，操作只有一个主动作 |
| 手机浏览 | 竖排 / 分栏在小屏上挤压；装饰元素占空间 | 小屏单列、图版在上、正文在下；菜单全屏抽屉 |
| 后台日常操作 | 装饰细线与业务信息混在一起，焦点态弱 | 工作台口径：去装饰、强焦点、密而有序 |

---

## 三、视觉系统方案（设计交付规格）

### 3.1 色彩

设计口径：**深墨底 + 暖骨白文字 + 堇色单点强调**。不再使用高饱和紫作为大面积光效。

| Token | 色值 | 用途 | 对比度（对 `night`） |
|-------|------|------|----------------------|
| `--color-night` | `#141017` | 页面底色（墨） | — |
| `--color-raised` | `#1b1620` | 抬升面：卡片、导航、弹层内容 | — |
| `--color-soft` | `#262029` | hover / 选中 / 输入面 | — |
| `--color-line` | `#3a323d` | 1px 结构线、分隔线、卡片描边 | 1.53（非文本） |
| `--color-line-strong` | `#75687e` | 强调描边、图版边框、控件边界 | 3.62（非文本，满足 3:1） |
| `--color-ink` | `#e9e2dc` | 主文字（暖骨白，替代冷白） | 14.67 |
| `--color-ink-dim` | `#a298a2` | 次级文字、说明 | 6.76 |
| `--color-ink-mute` | `#776d78` | 仅禁用态 / 非必要大号装饰文字（不可用于小号正文） | 3.80 |
| `--color-ink-on-paper` | `#2a232b` | 反白图版上的文字 | 12.70（对 paper） |
| `--color-paper` | `#efe9e4` | 极少数反白面（如海报式引用） | — |
| `--color-paper-dim` | `#d7cfc9` | 反白面次级元素 | — |
| `--color-primary` | `#b4a6bf` | 应援色：页码、活动态、关键图形 | 8.19 |
| `--color-primary-deep` | `#8f7d9e` | 主色加深：hover / 次级强调 | 5.01 |
| `--color-flower` | `#a184c9` | 焦点环、链接、直播状态点（降饱和） | 5.97 |
| `--color-eye` | `#7fb0e6` | 功能语义：直播中 / 舰长等级 | 8.29 |
| `--color-crimson` | `#e06a7a` | 功能语义：危险 / 总督 | 5.83 |
| `--color-gold` | `#d8b25c` | 功能语义：礼物 / 提督 | 9.36 |

使用规则：

- `vine` token **废弃**，全部替换为 `line` / `line-strong`；`flower` 不再承担大面积背景与光晕；
- 应援色 `#b4a6bf` 不做小号正文色（对比度不足），只用于图形、页码、活动态与大号文字；
- 功能语义色（`eye / crimson / gold`）只在弹幕看板、直播状态等有语义的位置使用，不参与页面装饰；
- 反白面（`paper`）只允许出现在「引用 / 海报式图版」一种场景，不作为普通卡片底色。

### 3.2 字体与字阶

| 角色 | 字体 | 用途 |
|------|------|------|
| 标题 / 正文阅读 | Noto Serif SC（400 / 600） | 页面标题、章节标题、长文、书名 |
| 界面 / 说明 | Noto Sans SC（400 / 500） | 导航、按钮、表单、正文说明、表格 |
| 图版编号 / 页码 | Cormorant Garamond（400 / 500 / italic） | 仅 `Sumire` 字标、图版编号、卷次大字 |
| 元数据 | `ui-monospace` 系统等宽栈（新增 `--font-mono`） | 日期、时间、尺寸、分类、文件大小、快捷键 |

字阶（`@theme`）：

| Token | 值 | 用途 |
|-------|-----|------|
| `--text-display` | `clamp(3.5rem, 7vw, 6.5rem)` | 首屏竖排书名（桌面） |
| `--text-h1` | `clamp(2.25rem, 4vw, 3.25rem)` | 页面标题 |
| `--text-h2` | `1.75rem` | 章节标题 |
| `--text-h3` | `1.25rem` | 卡片标题、条目标题 |
| `--text-body` | `1.0625rem` | 正文（默认） |
| `--text-small` | `0.9375rem` | 辅助说明 |
| `--text-label` | `0.75rem` | 元数据 / 页码 / eyebrow（mono，`letter-spacing: 0.12em`） |
| `--text-tiny` | `0.8125rem` | 版权、角标 |

规则：

- 中文标题只用 600，不再用 700 大字重「喊」；
- 长文行高 `1.9`，界面行高 `1.5`；正文单行宽度 ≤ 38 个汉字（约 `38rem`）；
- `font-display` 只出现在字标、图版编号、卷次，不再作为章节标签；
- 章节标签改为 `font-mono` 大写字距标签（如 `PROFILE / 01`），信息性优先。

### 3.3 网格、版心与节奏

| 项 | 规格 |
|----|------|
| 断点 | `<640px` 移动 / `640–1024px` 平板 / `>1024px` 桌面 / `>1440px` 宽屏 |
| 页面 gutter | 移动 `1.25rem` / 平板 `2rem` / 桌面 `4rem` |
| 宽版心 | `max-width: 88rem`（素材、日历、录播等公开宽页面；后台内容区沿用现状 64rem） |
| 阅读版心 | `max-width: 44rem`（档案正文、设定故事、表单） |
| 装订线 | 桌面 `≥1024px` 在每个公开页/每屏的内容列左侧画 1px 竖线（`border-left`，随版心移动；不是固定全屏浮层），后台不画 |
| 栅格 | 桌面 12 列 / gutter `2rem`；档案屏：文字 `col-span-6`、图版 `col-span-5`、偏移 1 列 |
| 区块节奏 | 页面内 section 间距 `6rem`（移动）/ `8rem`（桌面）；页面顶部为固定导航留 `6rem` |
| 圆角 | `2px`（图版、卡片）/ `4px`（标签）/ `8px`（输入、弹层）/ `999px`（仅状态药丸） |
| 描边 | 结构线统一 `1px solid var(--color-line)`；强调用 `line-strong`；不使用发光描边 |
| 阴影 | 仅弹层：`0 24px 64px rgb(0 0 0 / 0.55)`；卡片、按钮、导航一律无阴影 |

### 3.4 图像与图标

- **图版（Plate）**：官方立绘 / 插画 / 宣传图统一放在 1px 描边、无圆角的容器中；下方一行题注：`图版 01 · standing-01 · 立绘`（编号仅在该页有多个图版时出现）；
- 图版默认 `object-cover`（立绘用 `object-contain` + 同色内衬），保持原始比例；不裁成圆形、不加渐变蒙版；
- hover 只做 `opacity` 轻微下降到 `0.92` 与题注下划线，不做上浮、放大、泛光；
- 图标统一 Lucide，线宽 `1.5`，尺寸 `16 / 18 / 20`；不使用彩色图标；
- 不使用第三方插画；不再新绘制藤蔓 / 花 / 蕾丝 SVG。

### 3.5 动效

| 场景 | 规格 |
|------|------|
| 入场 | `opacity 0→1` + `translateY(8px→0)`，`480ms`，`cubic-bezier(0.22, 1, 0.36, 1)`；仅首屏与页面标题，不逐元素错峰 |
| 悬停 / 焦点 | 颜色、描边、透明度，`140ms` |
| 整页翻页 | 当前屏 `opacity 1→0`、`translateY(-8px)`；下一屏反向；`480ms`；装订线与页码不参与位移 |
| 弹层 | 遮罩 `opacity`，内容 `translateY(8px)`，`220ms` |
| reduced-motion | 全站（含公开站）尊重：无 `translate`/`scale`/视差/粒子；翻页改为 `120ms` 纯淡入或即时；环境动效不存在 |
| 循环动效 | 仅保留直播状态点的 `animate-pulse`；不新增任何循环动效 |

### 3.6 可访问性基线

- 正文与次级文字对底色的对比度 ≥4.5:1；大号文字 ≥3:1；结构线不承担信息传达；
- 所有可交互元素有 `:focus-visible` 2px `flower` 焦点环 + 2px 外偏移；焦点环不被 `overflow-hidden` 裁剪；
- 触摸目标 ≥44×44（移动端按钮、标签、分页、关闭键）；
- 导航与菜单：`aria-current="page"`、`aria-expanded`；移动端抽屉 Esc 关闭、焦点困于抽屉、关闭后焦点回到触发按钮、锁定背景滚动；
- 页面提供「跳到正文」skip link；
- 图片 `alt` 使用素材标题；装饰性图形 `aria-hidden`；
- 不出现仅靠 hover 才能获取的信息。

---

## 四、组件与页面改造

### 4.1 组件清单

| 现有组件 | 新组件 | 处理方式 | 关键状态 |
|----------|--------|----------|----------|
| `VineDivider` | `Rule` | 删除藤蔓；改为 1px 结构线，可带左端 mono 标签 | 默认 / 带标签 |
| `LaceFrame` | `Plate` / 普通描边容器 | 删除蕾丝；图版用 `Plate`，其余用 1px 描边 | 默认 / hover |
| `PaperCard` | `Surface` + `Notice` | 删除纸纹与角饰；普通面板用 `Surface`，提示用 `Notice` | `raised / outline / paper` |
| `ExternalButton` | `Button` | 合并为按钮体系，支持 `href` 外链与 `icon` | primary / secondary / ghost / danger |
| `Tag` | `Tag` | 方形标签，1px 描边、4px 圆角、hover 填充 | 默认 / hover |
| `VineTimeline` | `Timeline` | 去掉藤蔓轴与发光节点；改为「日期列 + 内容列」的编辑体年表 | 默认 / 当前项 |
| `SectionRail` | `PageIndex` | 树状圆点改为右侧页码索引（壹/贰/…），当前项用 16px 横线 + 标签 | 默认 / 当前 / hover |
| — | `PageShell` | 统一 gutter、版心、导航留白 | `wide / prose` |
| — | `PageHeader` | 页头：eyebrow + h1 + lead + actions + 1px 线 | 默认 / 带操作 |
| — | `SectionHeader` | 章节：folio + eyebrow + title + lead + actions | 默认 / 带操作 |
| — | `EmptyState` | 统一空态：标题 + 说明 + 一个主操作 | 默认 |
| — | `Button` | 四变体、两尺寸、loading、disabled | 见 §4.2 |
| — | `Field` | 输入 / 文本域 / 选择器统一壳层与错误态 | default / focus / error / disabled |

删除：`VineDivider`、`LaceFrame`、`PaperCard`、`ExternalButton`、`VineTimeline`、`GlowParticles`、`ParallaxLayer`、`SectionRail`，以及 `WeeklySchedule.tsx`（已无引用）。

### 4.2 基础组件规格

**Button**

| 变体 | 底 | 字 | 描边 | 用途 |
|------|----|----|------|------|
| primary | `primary` | `#141017` | 无 | 页面唯一主动作 |
| secondary | 透明 | `ink` | `line-strong` | 次要动作 |
| ghost | 透明 | `ink-dim` | 无 | 文字动作、返回 |
| danger | 透明 | `crimson` | `crimson/40` | 删除 / 撤销 |

- 高度：`md 44px` / `sm 36px`；水平内边距 `md 20px` / `sm 14px`；圆角 8px；
- 图标与文字间距 `8px`；loading 时保留宽度、文案变为「处理中…」并禁用；
- 不出现泛光、渐变、上浮。

**Field**

- 标签在上、`text-label` mono；输入面 `soft`、1px `line`、8px 圆角、高 44px；
- 聚焦：1px `flower` + 外 2px `flower/20` 环；
- 错误：`crimson` 描边 + 下方 12px 错误文案，`role="alert"`。

**Tag**

- 高 30px（移动 36px），1px `line` 描边，4px 圆角，`text-small`；
- hover 填充 `soft`，不做颜色反白。

**Surface**

- `raised`：`bg-raised` + 1px `line`；`outline`：透明 + 1px `line`；`paper`：反白面，仅引用场景；
- 内边距 `20 / 24 / 32px` 三档；圆角 2px；无阴影。

**Notice**

- 左侧 2px `primary` 竖线 + `raised` 底；标题 `text-h3`，正文 `text-small`；
- 用于素材版权、服务未配置、页面级提示。

**Timeline**

- 桌面两列：日期 `8rem`（mono、右对齐）+ 内容；行间 1px `line`；当前项日期用 `primary`；
- 移动单列：日期在上、内容在下；不画轴、不画节点；
- 保留现有时间顺序与文案。

**PageIndex**

- 固定视口右侧，竖排页码（壹/贰/叁/肆/伍/陆/柒/捌）；
- 当前项：16px `primary` 横线 + 中文标签（如「档案 · 喜好」）；
- 非当前项：仅 `text-label` 页码，`ink-dim`；hover/focus 显示标签；`ink-mute` 只用于禁用态，不用于小号可读信息；
- `nav aria-label="页面位置"`，每项 `<a>` 有 `aria-label` 与 `aria-current`；
- `<1024px` 隐藏（移动端用顶部导航与滚动进度条替代——进度条为 1px `line-strong` 顶部细线）。

**PageHeader / SectionHeader**

- eyebrow：mono 大写 + 字距；folio：`Cormorant` 大号页码（如 `壹`）；
- 标题：Noto Serif SC 600；lead：`text-ink-dim`，最大 38rem；
- 底部 1px `line`，与内容间距 `2.5rem`。

### 4.3 全局壳

#### 4.3.1 NavBar

```
┌──────────────────────────────────────────────────────────────┐
│ 枝堇 Sumire        主页  档案  素材  日历  录播  棉花糖      │ 64px
├──────────────────────────────────────────────────────────────┤ 1px line（滚动后出现）
```

- 高 64px；默认透明，滚动 >24px 或移动端菜单展开后 `night/85` + `backdrop-blur`；
- 左侧字标：中文 Noto Serif SC 600 + `Sumire` Cormorant italic，字号降为 `1rem`；
- 导航项：`text-small`、字距 `0.04em`；活动态为 `ink` + 底部 1px `primary` 下划线（距文字 6px）；非活动 `ink-dim`；
- 右侧不再放装饰图标；外链只在页脚；
- 移动端：全屏抽屉（`night` 底），大号导航列表（`text-h2`），底部版权信息；Esc 关闭、焦点陷阱、关闭后焦点返回；
- 未上线功能不出现在导航（沿用现有门控）。

#### 4.3.2 Footer（版权页）

```
──────────────────────────────────────────────── 1px line
堇色书屋                 站点                 关注
非官方粉丝站…            主页 / 档案 / 素材     B 站空间 ↗
免责声明（完整）          日历 / 录播 / 棉花糖   直播间 ↗ / 萌娘百科 ↗ / 小密室 ↗
应援色 #b4a6bf                                  © 2026 堇色书屋
```

- 三栏（桌面）/ 单列（移动）；顶部 1px `line`；无蕾丝条、无背景色块；
- 免责声明完整展示，不截断；
- 外链统一 `↗` 图标与 `rel="noopener noreferrer"`；
- 首页仍只在素材站尾部渲染全站唯一 Footer；非首页经 `(content)/layout.tsx` 渲染。

#### 4.3.3 PageIndex（位置索引）

- 取代 `SectionRail`；桌面右侧固定，`aria-label="页面位置"`；
- 站序与 `sections.ts` 同源；未配置 API 时「日历」缺席；
- 页码使用中文数字：壹（首页）、贰~陆（档案五节）、柒（日历）、捌（素材）；
- 点击跳转沿用 `goTo`；键盘 Tab 可达。

### 4.4 首页 deck

**Hero（首页站）**

```
│
│ VIRTUALREAL / 28期                          ┌──────────────┐
│                                             │              │
│ 枝                                            │   standing-01 │
│ 堇           （竖排，桌面）                    │   图版 01     │
│                                             │              │
│ Sumire                                      └──────────────┘
│ 是老书屋的一株藤蔓，喜欢雨水和雾，破旧的纸张。
│ ────────────────────────────────
│ ● 直播中    今日 21:00 杂谈
│ 免责声明（小号）
```

- 删除雾气与粒子；背景为 `night` + 一处静态径向微光（`primary/6%`，无动画）；
- 立绘改为右侧图版（桌面 `46%` 宽、`object-cover object-top`、1px 描边、无视差）；移动端图版在上（`55svh`），文字在下；
- 书名桌面竖排（`writing-mode: vertical-rl`，字距 `0.08em`），移动端横排；
- 直播状态与今日日程合并为「元数据行」：`● 直播中` + `今日 21:00 主题`，两项之间 12px 间距，下方 1px 线；
- 入场只保留标题与简介的 `fade + 8px`，不逐元素错峰。

**档案五屏（P1~P5）**

```
│ 贰 / PROFILE                                       枝堇 · 档案
│ 信息
│ ──────────────────────────────────────────────────────────
│ 本名      枝堇Sumire                         ┌────────────┐
│ 生日      4月2日（白羊座）                    │            │
│ …                                           │  图版 02    │
│                                             │            │
│                                             └────────────┘
│                                             图版 02 · standing-02
```

- 五屏统一阅读轴：文字恒左（6 列）、图版恒右（5 列），**取消左右交替**；
- 每屏有 `SectionHeader`（folio + eyebrow + 标题）与 1px 线；
- P1 信息表改为两列定义表，标签 `ink-dim`、值 `ink`；不再嵌套蕾丝框；
- P2 设定：宋体正文、首行缩进 2 字符；引文用 2px `primary` 左边线，不用浅色纸卡；
- P3 喜好：标签组，标签为方形 chip；组名在左（`6rem`），标签换行；
- P4 历程：`Timeline` 年表；当前项（最新）用 `primary` 日期；
- P5 轶闻：2 列 `Surface` 卡片 + 官方外链 `Button` 组；
- 移动端：图版在上（`40svh`，不再全屏背景 + 毛玻璃），内容在下；内容超屏时列内滚动，行为不变。

**日历站**

- 保留 `immersive` 全幅月视图与全部交互（拖拽翻月、当日详情、周视图、历史条目）；
- 网格改为 1px `line` 分隔、单元格无圆角、无底色；今天为 `primary` 圆点 + `primary` 日期；
- 翻月按钮改为左右 gutter 内的 44×44 `ghost` 圆形按钮（仅图标），不再全高竖条；
- 星期标签 `text-label` mono；日程摘要 `HH:mm 主题`，时间用 mono、主题用 sans。

**素材站**

- 全幅图版网格（1/2/3/4 列）；图版无圆角、1px 描边；题注在图片下方（标题 + 分类）；
- 分类筛选改为下划线 tab（`全部 / 立绘 / 插画 / 宣传图`），选中为 `ink` + `primary` 下划线，高度 44px；
- Lightbox：`night/96` 遮罩、图版居中、底部信息条（标题 / 分类 / 尺寸 / 备注）+ 「下载原图」主按钮；Esc / 遮罩关闭、焦点陷阱、锁定滚动；
- 素材站尾部 Footer 改为版权页式。

### 4.5 档案页 `/about`

- `PageShell` 阅读版心 + `PageHeader`（eyebrow `PROFILE`、标题「枝堇图鉴」、引文）；
- 五节内容复用首页同源组件；统一 `SectionHeader` 与 1px 分隔；删除 `VineDivider`；
- 立绘图版恒右；移动端图版在上；
- 不约束整屏高度，自然滚动；锚点与元数据不变。

### 4.6 素材页 `/assets`

- `PageShell` 宽版心 + `PageHeader`；
- 版权提示由 `PaperCard` 改为 `Notice`（左侧 `primary` 竖线，完整免责声明）；
- 画廊与 Lightbox 同首页素材站同源。

### 4.7 日历页 `/calendar`

- `PageHeader` + 日历主体；未配置 API 时仍渲染站点 404（口径不变）；
- 视觉同首页日历站；后台日历（`/backdoor/schedule`）保持 `panel` 变体，仅继承 token 与基础控件。

### 4.8 录播 / 回放 / 棉花糖

- 页面壳层统一：`PageShell` + `PageHeader`；
- 录播状态列表、文件行、分页、听直播、下载菜单：保留行为，统一按钮/描边/焦点；
- 回放页：视频保持黑底；事件列、时间线、弹层套用新 token；弹幕浮层白字不变；
- 棉花糖：卡片、表单、弹窗、空态统一到 `Surface / Field / Button / EmptyState`；
- 不改变任何请求、契约、业务状态机。

### 4.9 404 与空态

- 404：去掉径向紫光与花体 404；改为 `404` mono 大号（`text-ink-mute`、`aria-hidden`，语义由 `h1` 承载）+ 标题 + 说明 + 「返回首页」`Button`；
- 全站空态统一 `EmptyState`：一句说明 + 一个主操作；无插画、无装饰图形。

### 4.10 后台 `/backdoor`（范围受限）

只做以下几件事，**不重排业务页面布局、不改交互逻辑**：

1. **token 对齐**：新色板/字阶/圆角/描边/焦点环；`vine` 全部替换为 `line`；
2. **基础控件**：`PrimaryButton` / `TextField` / `RoleSelect` / 弹层壳层迁移到共享 `Button / Field / Surface`，视觉统一；
3. **壳层清理**：TopBar、SideNav、LoginCard、ChangePasswordCard、仪表盘移除藤蔓装饰线（`VineDivider`）与花体标签；登录卡改为 1px 描边 + 顶部 1px `primary` 线；侧栏活动态为 2px `primary` 左线 + `soft` 底；
4. 表格（用户管理、弹幕检索、直播计划列表）保留现有列与操作，只调整描边、行高、hover、焦点与危险色；
5. 后台仍严格执行 `prefers-reduced-motion`，且不引入公开站的装订线。

### 4.11 响应式规则

| 断点 | 导航 | 版心 | 档案 / 图版 | 日历 |
|------|------|------|-------------|------|
| `<640px` | 全屏抽屉 | 单列，gutter 20px | 图版在上（40svh），内容在下 | 周视图（不变） |
| `640–768px` | 全屏抽屉 | 单列，gutter 32px | 图版在上（40svh） | 周视图 |
| `768–1024px` | 横向导航 | 单列/两列，gutter 32px | 图版在上（45svh） | 月视图 |
| `>1024px` | 横向导航 + 装订线 | 12 列，gutter 64px | 文字左 / 图版右 | 月视图 + 拖拽 |
| `>1440px` | 同上 | 宽版心 88rem 居中 | 同上 | 同上 |

### 4.12 异常与边界

| 情况 | 预期行为 |
|------|----------|
| `prefers-reduced-motion: reduce`（含运行时切换） | 全站无位移/缩放/视差/粒子；翻页 120ms 纯淡入或即时；悬停只变颜色 |
| 320px 窄屏 / 200% 缩放 | 无横向滚动；竖排书名切为横排；导航收为抽屉 |
| 字体加载中 / 失败 | 使用系统 serif/sans 回退，不产生 CLS（沿用 `next/font`） |
| 图片缺失 / 加载失败 | 图版保留 1px 框与题注，显示 alt 文本；不塌陷 |
| 未配置 API / 录播服务 | 导航入口与页面降级口径完全沿用现状；不出现占位入口 |
| Lightbox / 弹层打开 | 锁定背景滚动；Esc 关闭；焦点陷阱；关闭后焦点回到触发元素 |
| 手机横屏 | 图版高度按 `svh` 收缩；内容可滚动，不遮挡导航 |
| 高对比度 / 强制颜色模式 | 描边与焦点仍可见；不使用仅靠背景色区分状态 |

---

## 五、非功能需求

### 5.1 性能

- 删除 `GlowParticles`（Canvas rAF 常驻）与 `ParallaxLayer`（指针/传感器监听），减少持续重绘与主线程工作；
- 不新增运行时依赖、不新增字体；图标继续使用 `lucide-react`；
- 首屏立绘保持 `priority` 与固定尺寸，避免 CLS；
- 动画仅使用 `opacity` / `transform`；弹层与图版不触发布局；
- 目标：公开站首屏 JS 不增加（预期减少）；Lighthouse 移动端 Performance ≥ 90、Accessibility ≥ 95（评审环境实测，作为硬性目标，不达标需说明原因）。

### 5.2 可访问性

- 正文/次级文字对比度 ≥4.5:1（色板已给出实测值）；
- 焦点环、键盘顺序、skip link、移动抽屉焦点管理、弹层焦点陷阱；
- 触摸目标 ≥44×44；
- `prefers-reduced-motion` 全站尊重；
- 语义：每页唯一 `h1`，章节 `h2`，卡片标题 `h3`；导航 `aria-current`；图版 `figure/figcaption`。

### 5.3 兼容性

- 桌面 Chrome / Firefox / Safari 最近两个大版本；移动 Safari、Android Chrome；
- `writing-mode: vertical-rl` 在目标浏览器均支持；不支持时回退横排（`@supports`）；
- `backdrop-filter` 不可用时用 `night/95` 纯色回退；
- 纯静态导出（`output: "export"`），首屏 SSG 直出，无 hydration 差异。

### 5.4 可维护性

- 颜色/字阶/圆角/时长只允许来自 `@theme` token；组件内不写十六进制色值；
- 基础组件无业务逻辑，业务组件不重复实现按钮/输入/空态；
- 装饰性 SVG 组件不再新增；确需图形时用 CSS 结构或图标；
- 设计文档与 spec 在同一实现 PR 内同步。

---

## 六、范围与非目标

### 6.1 范围

- 公开站：`/`（首页 deck 全部 8 站）、`/about`、`/assets`、`/calendar`、`/topics`、`/recordings`、`/recordings/replay`、404；
- 全局壳：`NavBar`、`Footer`、`PageShell`、`PageHeader`、`SectionHeader`、`PageIndex`；
- 基础组件：`Button`、`Field`、`Tag`、`Surface`、`Notice`、`Plate`、`Timeline`、`Rule`、`EmptyState`；
- 后台：token、基础控件、TopBar / SideNav / 登录 / 改密 / 仪表盘壳层、表格视觉；
- 文档：`docs/design/01-visual-identity.md`、`02-page-design.md`、`03-backdoor-design.md`、`docs/product/spec/site-pages.md`、`calendar.md`、`docs/engineering/spec/frontend-bookstore.md`、`apps/bookstore/AGENTS.md`。

### 6.2 非目标

- 不修改任何文案与档案内容（禁止二次设定）；
- 不修改 IA、路由、导航信息结构、整页翻页机制；
- 不修改 API、契约、数据模型、后台业务逻辑与权限；
- 不做亮色主题、主题切换、字号偏好设置；
- 不引入 Storybook、Tailwind 插件、第三方 UI 库；
- 不重排后台业务页的信息架构（仅统一视觉与基础控件）；
- 不做全新的品牌 Logo / 字体设计（沿用现有字标与字体）。

---

## 七、依赖与约束

### 7.1 依赖

- 现有内容：`content/{site,profile,assets}.yaml`、`lib/content/`；
- 现有页面与业务组件：`features/home`、`features/about`、`features/assets`、`features/schedule`、`features/recordings`、`features/topics`、`features/backdoor`；
- 现有基建：Next.js App Router + SSG、Tailwind CSS v4 `@theme`、`next/font`、Lucide、Vitest、Playwright；
- 规范：`docs/engineering/frontend-rules.md`、`apps/bookstore/AGENTS.md`。

### 7.2 约束

- 仅使用 `@theme` token，禁硬编码色值（既有规范）；
- 分支 `<type>/<slug>`：本需求文档分支 `prd/visual-system-redesign`，实现分支 `feat/visual-system-redesign`；
- 遵循 TDD；提交前 `pnpm lint && pnpm test && pnpm build` 全绿；
- 未上线功能不得出现入口；
- spec 只描述现态；本期实现 PR 必须同步设计文档与 spec，不得留下旧口径。

---

## 八、验收标准

### A. 设计系统

- [ ] A1 所有颜色来自 `@theme` token；新增 `line / line-strong / ink-mute`；`vine` 已从代码与 token 中移除；
- [ ] A2 圆角只出现 `2px / 4px / 8px / 999px` 四档；无 `rounded-xl / 2xl` 散落；
- [ ] A3 阴影只用于弹层；仓库无 `shadow-[0_0_…]` 类泛光；
- [ ] A4 `font-display` 只用于 `Sumire` 字标、图版编号、卷次；无花体章节标签残留；
- [ ] A5 公开页统一 `PageShell`（宽版心 88rem / 阅读版心 44rem）与 gutter；
- [ ] A6 结构线统一 1px `line`，强调 1px `line-strong`；无渐变描边、无发光。

### B. 装饰清理

- [ ] B1 `VineDivider`、`LaceFrame`、`PaperCard`、`ExternalButton`、`VineTimeline`、`GlowParticles`、`ParallaxLayer`、`SectionRail` 文件删除，全仓无引用；
- [ ] B2 `globals.css` 无 `.lace-x`、`.paper`、`.vine-draw`、`.flower-node`、`.fog`、`fog-drift`、`vine-grow`；
- [ ] B3 首页无 Canvas 粒子、无指针/传感器视差；
- [ ] B4 页脚无蕾丝扇贝条；404 无径向紫光；
- [ ] B5 档案时间线无藤蔓轴、无发光节点。

### C. 页面

- [ ] C1 NavBar：64px、活动态下划线 + `aria-current`、移动抽屉 Esc/焦点/滚动锁；
- [ ] C2 Footer：版权页三栏、顶部 1px 线、移动单列；全站唯一 Footer 位置不变；
- [ ] C3 首页 Hero：桌面竖排书名、图版题注、直播/日程元数据行；无粒子与雾；
- [ ] C4 档案五屏统一阅读轴（文字左、图版右），页码与标题层级正确；P4 溢出滚动与初始锚定行为保留；
- [ ] C5 `/about` 与首页同源、无左右交替、无藤蔓分隔；
- [ ] C6 日历视觉更新但拖拽翻月、当日详情、周视图、历史条目行为不变；
- [ ] C7 素材：下划线分类、图版网格、全屏 Lightbox；筛选/下载/关闭行为不变；
- [ ] C8 录播 / 回放 / 棉花糖：壳层统一，请求与业务状态机不变；
- [ ] C9 后台：token/控件/壳层统一，业务布局与交互不变；
- [ ] C10 404 与全站空态统一为 `EmptyState`。

### D. 可访问性与动效

- [ ] D1 正文与次级文字对比度 ≥4.5:1；大号文字 ≥3:1；
- [ ] D2 所有交互元素 `:focus-visible` 2px `flower` 焦点环，且不被裁剪；
- [ ] D3 `prefers-reduced-motion: reduce` 下全站无位移/缩放/视差/粒子；
- [ ] D4 键盘可完成导航、菜单、弹层、筛选、下载；
- [ ] D5 移动端触摸目标 ≥44×44；
- [ ] D6 无 hover-only 信息；无仅靠颜色区分状态。

### E. 工程

- [ ] E1 无新增运行时依赖、无新增字体；
- [ ] E2 `pnpm lint && pnpm test && pnpm build` 全绿；
- [ ] E3 公开站与后台 E2E 全部通过；受影响的粒子/雾/视差/树状索引断言已更新；
- [ ] E4 公开站首屏 JS 与主线程工作不增加（预期减少）；
- [ ] E5 无 CLS；图片尺寸与 `priority` 口径保持；
- [ ] E6 设计文档、产品 spec、技术 spec、`apps/bookstore/AGENTS.md` 同 PR 同步。

---

## 九、评审关注点（请重点确认）

| # | 决策 | 建议 | 影响 |
|---|------|------|------|
| 1 | 是否移除常驻粒子 / 视差 / 雾气 | **移除**，改为静态径向微光 + 暖骨白排版 | 去掉视觉噪音与耗电；站点从「动效氛围」转为「编辑设计」。如希望保留少量氛围，可只保留静态光晕 |
| 2 | reduced-motion 口径 | 由「公开站氛围层不降级」改为**全站尊重** | 更易用、更无障碍；需同步修改设计文档与 spec 中的特批口径 |
| 3 | 档案五屏是否继续左右交替 | **取消交替**，文字恒左、图版恒右 | 阅读位置稳定；五屏更统一，但少了「翻页节奏」的视觉变化 |
| 4 | 后台改造范围 | 仅 token + 基础控件 + 壳层/表格视觉 | 控制回归面；后台业务布局不动。若希望后台也整体重排，需单独立项 |
| 5 | 是否保留整页翻页 deck | **保留**，只重做视觉与索引 | 保留站点叙事特色；若改为普通长页，属 IA 变更，不在本期范围 |
| 6 | 桌面竖排书名 | **采用**，移动端横排，`@supports` 回退 | 提供记忆点；若评审觉得风险高，可退回横排，其余设计不受影响 |

---

## 十、相关文档

- 视觉识别（现态，待本期实现 PR 更新）：`docs/design/01-visual-identity.md`
- 页面设计（现态，待更新）：`docs/design/02-page-design.md`
- 后台设计（现态，待更新）：`docs/design/03-backdoor-design.md`
- 产品 spec（现态）：`docs/product/spec/site-pages.md`、`docs/product/spec/calendar.md`
- 技术 spec（现态）：`docs/engineering/spec/frontend-bookstore.md`
- 本期技术提案：`docs/engineering/proposals/2026-11-01-visual-system-redesign-proposal.md`
- 前端规范：`docs/engineering/frontend-rules.md`、`apps/bookstore/AGENTS.md`
