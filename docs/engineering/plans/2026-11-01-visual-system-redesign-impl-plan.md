---
description: 全站视觉系统重设计实现方案 v1.0——基于 PRD v1.0 与技术提案 v1.0 的可执行实施计划。在 apps/bookstore 先做 token 加法（line/line-strong/ink-mute/mono/radius/duration）与全仓 vine→line 机械替换（70 文件 198 行），再落 8 个 Primitive、3 个 Pattern 与 focus trap，随后按「壳层 → 首页 deck → 公开内容页 → 录播/棉花糖 → 后台 → 清理收口」分 7 个阶段迁移；装饰组件随最后一个消费者一起删除以保证每个提交可构建；含口径裁定 8 条、删除与迁移映射、测试矩阵、e2e 逐条影响、验收对照与回滚。零新增依赖、零后端/契约变更、文案零改动。
type: Permanent
---

# 全站视觉系统重设计：装订（The Binding）实现方案

**关联 PRD**: [[../../product/requirements/draft/2026-11-01-visual-system-redesign-prd.md]]（v1.0）
**关联技术提案**: [[../proposals/2026-11-01-visual-system-redesign-proposal.md]]（v1.0）
**需求总分支**: `prd/visual-system-redesign`（需求总 PR：<https://github.com/Deliay/sumire/pull/154>）
**集成分支**: `feat/visual-system-redesign`（自需求总分支切出；下列三个子分支顺次 PR 合入本分支，最后整体 PR 回需求总分支）
**版本**: v1.0（2026-11-01）
**作者**: sumire workflow
**评审样品**: `docs/design/2026-11-01-visual-system-concept.html`（离线可开的概念页，陈列色板/字阶/版心/组件/页面骨架与 6 个待确认决策；不是线上页面，不进路由、不进构建）

本方案把提案 v1.0 落成可执行步骤，遵循 TDD：每步先补失败用例再实现，每步结束 `pnpm lint && pnpm test && pnpm build` 全绿。变更面仅 `apps/bookstore` 前端 + 文档，无契约/后端/编排变更，零新增依赖与字体。

> **与提案的关系**：提案给的是架构与盘点，本方案给的是**顺序、粒度、逐文件动作与口径裁定**。提案与实际代码冲突时以本方案的「§2 口径裁定」为准，裁定理由随附，均不改变 PRD 的产品结论。

## 1. 前提事实（已在需求总分支 commit 5ff947f 核对）

**Token 现态**

- `apps/bookstore/app/globals.css` 共 176 行：`@theme` 在 `:9`，颜色 `:10–36`（含 `--color-vine: #5e4a75`），字体 `:38–41`，字阶 `:44–50`（无 `h3` / `label` / `mono`），动效 `:53–57`；装饰 CSS —— `.fog/.fog-a/.fog-b` `:67–89`、`.lace-x` `:92–99`、`.paper` `:100–109`、`.vine-draw`/`@keyframes vine-grow` `:111–122`、`.flower-node` `:125–133`；reduced-motion 块 `:169–176` 只对 `.animate-danmaku-flash` 降级。
- 硬编码色值残留：`.flower-node` 的 `#cfb2f2`、`.paper` 的 `rgb(139 95 214)`、`@keyframes danmaku-flash` 的 `rgb(139 95 214 / .15)`、`components/NotFoundPage.tsx:11` 的径向渐变——都与「只用 `@theme`」规范相悖，本期一并清掉。

**装饰与引用面（这是本期最大的机械工作量）**

- `vine` 命中：`apps/bookstore` 内 **70 个文件、198 行**（其中类名 `-vine` 192 行；含 `app/globals.css` 与 1 个单测 `tests/unit/nav-bar.test.tsx:165`）。分布覆盖公开站、后台、弹幕看板、弹幕检索、周表弹窗、棉花糖、Markdown 编辑器——提案「token 迁移」一句带过，实际是全仓扫。
- 具象装饰组件：`components/{VineDivider,LaceFrame,PaperCard,ExternalButton}.tsx`、`features/about/{VineTimeline,parts/SectionTitle}.tsx`、`features/home/{GlowParticles,ParallaxLayer,SectionRail,WeeklySchedule,glowParticles,parallax,useParallax,sectionRail}.ts(x)`。
- `features/home/WeeklySchedule.tsx` 已无引用（仅自身定义）；`SectionTitle.tsx` 仅被 `features/about/parts/*` 引用。
- 触屏端视差/雾/毛玻璃集中在 `features/about/parts/SplitSection.tsx`（`:76`、`:109` 两处 `ParallaxLayer`，`heroMobilePortrait` 分支 `:71/:96–101/:108–118`）。

**壳层现态**

- `app/(site)/layout.tsx` 只有 `NavBar` + `<main>`，无 skip link、`main` 无 `id`；`(content)/layout.tsx` 渲染 `Footer`；`Footer` 只接 `{ site }`（`:4–6`），无导航列，靠 `.lace-x`（`:18`）+ `bg-raised` 条。
- `NavBar` 201 行：`h-16`、`tracking-widest`、活动态 `text-primary`、滚动线用 `shadow-[0_1px_0_0_var(--color-vine)]`（`:138–139`），移动端为内联 `<ul>`（`:182–199`）——**没有焦点陷阱、没有 Esc、不锁滚动**。
- `NotFoundPage` 31 行：花体 404 + 内联径向紫光。
- `AssetGallery` 173 行：`rounded-full` 筛选、`hover:-translate-y-0.5`、`hover:scale-[1.03]`、`shadow-[0_0_18px…]` 下载按钮；Lightbox 仅有初始聚焦 + Esc（`:32–43`），**无 Tab 循环**。

**测试现态（受影响的精确位置）**

| 文件 | 现状断言 | 本期动作 |
|------|----------|----------|
| `tests/unit/home-glow-particles.test.ts`、`home-glow-particles-canvas.test.tsx` | 粒子纯函数 / Canvas 主循环 | 删除 |
| `tests/unit/home-parallax.test.ts`、`home-parallax-layer.test.tsx` | 视差纯函数 / 容器 | 删除 |
| `tests/unit/home-section-rail.test.ts` | `buildTree` / `activeNode` | 改名并改写为 `home-page-index.test.ts` |
| `tests/unit/home-visual-fx.test.tsx` | `:23/:27` mock 粒子/视差，`:167` 断言 canvas + 视差层 | 改写为「无 canvas / 无雾 / 有 PageIndex / 有图版题注」 |
| `tests/unit/home-deck-sections.test.tsx` | `:40` 断言无 `.lace-x`、`:100` 断言 `ParallaxLayer` | 改写为 `SectionHeader` / `Plate` / 固定阅读轴 |
| `tests/unit/home-fullpage-deck.test.tsx` | `:65` 断言 canvas + SectionRail、`:89` 圆点索引点击 | 改写为 PageIndex 页码 + 进度条 |
| `tests/unit/home-weekly-guard.test.tsx` | `:23/:27` mock 粒子/视差 | 去掉 mock，保留 guard 断言 |
| `tests/unit/nav-bar.test.tsx` | `:165` 断言 `max-md:shadow-[0_1px_0_0_var(--color-vine)]` | 改写为滚动线 + `aria-current` + 抽屉焦点/Esc/滚动锁 |
| `tests/e2e/src/bookstore/site.spec.ts` | `:54` SectionRail、`:162` 「今日日程」标题、`:167` canvas/视差、`:177` 视差出血、`:212` reduced 不降级 + 雾、`:251` 立绘 gap=0 出血 | 逐条改写（见 §5.4） |
| `tests/e2e/src/bookstore/calendar.spec.ts` | `:122` 「左右全高翻月竖条」 | 改为 44×44 图标按钮 |
| `tests/e2e/src/backdoor/topics.spec.ts` | `div.border-t.border-vine` 结构选择器 | 改为新结构 |

**可用的既有能力**：`lib/useMediaQuery.ts`（`useSyncExternalStore`，SSR 快照 false）、`lib/useContainerWidth.ts`、`features/schedule/useDismiss.ts`（点击外部 / Esc）、`features/home/fullpage.ts`（手势纯函数，本期不动）、`features/danmaku`（语义色 `eye/crimson/gold`，本期只换 token 不换逻辑）。

## 2. 口径裁定（提案未覆盖或与 PRD 冲突，实现按此执行）

| # | 冲突 / 缺口 | 裁定 | 理由 |
|---|-------------|------|------|
| 1 | PRD §4.3.3 给 8 个扁平 folio（壹、贰~陆、柒、捌）；提案 §5.1 仍按 `buildTree` 渲染「主节点 + 子节点」两级 | **扁平 8 项**：`sections` 顺序即页码顺序，`archive-*` 的标签拼成「档案 · 喜好」 | 两级树会让「档案」父节点与五个子节点重复占号，与 PRD 的 8 个 folio 直接矛盾；扁平列表也让 `aria-current` 与 `PageIndex` 的「当前项横线 + 标签」语义更简单。`sectionRail.ts` 随之删除，新建 `pageIndex.ts`（`indexEntries` / `activeEntry` 两个纯函数） |
| 2 | PRD §4.5 写 `/about` 用「阅读版心 44rem」；提案 §6.3 写 `PageShell width="wide"` + 内文 ≤34rem | **`wide` 88rem + 内文测量宽 ≤36rem** | 档案分栏是「文字 + 图版」，44rem 放不下 6/5 列；内文单独限宽即可保住阅读舒适度。实现 PR 同步更新 `site-pages.md` 与 PRD 的实现口径记录 |
| 3 | 提案 P0 一次性删 `--color-vine` 与装饰 CSS | **加法先行，删除随最后一个消费者**：P0 只加 token / 改色值；`vine` 类名在 P0b 全量替换；`--color-vine`、`.lace-x`、`.fog`、`.paper`、`.vine-draw`、`.flower-node` 在对应组件删除的同一步删掉；P7 兜底 | `border-vine` 一旦失去 token，Tailwind 会静默丢弃该类（不报错），页面直接掉边线；`.paper` 仍被 `PaperCard` 使用，先删会出白底卡。按消费者删除可保证**每个提交都能构建、页面不会中间态崩坏** |
| 4 | 提案定义 `--duration-fast/base/slow` 并写 `duration-fast` 类 | **token 保留，用法改为 `duration-(--duration-fast)`**（不支持时退回 `duration-[var(--duration-fast)]`） | Tailwind v4 没有 `--duration-*` 工具命名空间（只有 `--default-transition-duration`），`duration-fast` 不会生成类；`--ease-*`/`--radius-*`/`--shadow-*`/`--tracking-*`/`--text-*` 才是命名空间 |
| 5 | `Footer` 现在只接 `site`，版权页需要导航列 | 扩展为 `{ site }` + 组件内部由 `SECTIONS` / `apiConfigured` / `recordingsConfigured` 派生，**不新增 props**（Footer 仅被 Server Layout 引用） | 少改调用点；门控口径与 `NavBar` 同源（`API_CONFIGURED`、`RECORDINGS_CONFIGURED`、`tools` 不进页脚），不会出现未上线入口 |
| 6 | 提案要求「焦点陷阱」但没说落在哪，且现有 Lightbox 只有初始聚焦 + Esc | 新增 **`lib/useFocusTrap.ts`**（含纯函数 `focusablesIn`、首尾循环、初始聚焦、关闭后焦点归还、可选滚动锁），`NavBar` 抽屉 / Lightbox / 后台弹窗统一复用 | 三处需求同一实现，可单测；不然三份手写 Tab 循环必然漂移 |
| 7 | 提案 `Plate` 既给素材网格（`fill` 场景）又给 Lightbox（`max-h` 场景） | API 加 `sizes?`、`fit?`、`as?`、`index?`、`caption?`，**不用 `fill`**：网格用固定 `width/height` + `aspect-[4/5]` 容器 + `h-full w-full object-cover` | 避免 `fill` 需要父级 `relative` 的隐式契约，也让 SSG 输出带尺寸防 CLS；`as="div"` 时题注降级为 `<span>`，供「整卡可点」的卡片结构使用（不把 `figure` 嵌进 `button`） |
| 8 | `Tag` 在 PRD 里写 hover 填充，但档案喜好标签不可交互 | `Tag` 增 `as?: "span" \| "button"`，hover/active 只在 `button` 上生效 | 可交互标签与静态标签视觉同源、语义不撒谎 |

另有两处实现细节写死，避免实现期二次猜测：

- `Plate` 的 `object-contain` 立绘必须配同色内衬（`bg-soft`），否则透明 PNG 会在 `raised` 上出现色块边界；
- `Notice` 的 `tone`：`info` → 左线 `primary`；`warning` → 左线 `gold`。PRD 只规定了 `info`，`warning` 仅用于「服务未配置 / 版权风险」两处，不新增第四种语义色。

## 3. 分支、提交与 PR

- 本实现计划与概念页直接提交到需求总分支 `prd/visual-system-redesign`（本节点产物）；
- 开发在 `feat/visual-system-redesign`（集成分支）上进行，自需求总分支切出；
- 按下表拆 3 个可评审 PR，均以集成分支为 base、顺次合入（禁止 rebase/squash，只 merge）：

| PR | 分支 | 内容 | 门禁 |
|----|------|------|------|
| 1 | `feat/visual-system-foundation` | P0–P2：token、`vine` 全仓替换、Primitive / Pattern、NavBar / Footer / 404 / skip link | `lint/test/build`；截图：导航、页脚、404、组件页 |
| 2 | `feat/visual-system-public-pages` | P3–P5：首页 deck、`/about`、`/assets`、`/calendar`、录播/回放/棉花糖 | 公开站 e2e 全绿；375/768/1440 三档截图 |
| 3 | `feat/visual-system-backdoor` | P6–P7：后台、删除收口、`rg` 零命中、spec / 设计文档 / AGENTS 同步 | 后台 e2e 全绿；最终 `pnpm test:e2e` |

- 收尾 PR：`feat/visual-system-redesign` → `prd/visual-system-redesign`，描述里附截图清单与「决策点 1–6 的落实说明」；
- 提交信息 `<type>: <描述>`；删除组件与引用清理放同一提交；文档同步与代码同 PR。

## 4. 实施步骤

### 步骤 0：切分支与基线核对

自 `prd/visual-system-redesign` 切 `feat/visual-system-redesign`，再切 `feat/visual-system-foundation`。

**基线核对**（写入 PR 描述，便于复现）：`grep -rn "vine" apps/bookstore/{app,components,features,lib,tests} | wc -l` = 198 行 / 70 文件（其中类名 `-vine` 192 行）；`ls apps/bookstore/tests/unit | wc -l`；`pnpm -C apps/bookstore build` 记录首屏 JS 体积基线。

**验证**：分支名正确；基线命令输出记录在 PR 描述。

---

### 步骤 1（P0a）：Token 加法与基础样式（TDD）

**单测先行（红）** —— 新增 `apps/bookstore/tests/unit/design-tokens.test.ts`：

1. 读 `app/globals.css` 文本，用正则解析 `--<name>: <value>` 到 Map；
2. 断言新增 token 存在且值正确：`--color-line #3a323d`、`--color-line-strong #75687e`、`--color-ink-mute #776d78`、`--font-mono`、`--text-h3 1.25rem`、`--text-label 0.75rem`、`--tracking-label 0.12em`、`--radius-xs/sm/md/pill`、`--shadow-overlay`、`--duration-fast/base/slow`、`--ease-out-quart`、`--animate-enter`；
3. 断言值调整到位：`--color-night #141017`、`--color-raised #1b1620`、`--color-soft #262029`、`--color-ink #e9e2dc`、`--color-ink-dim #a298a2`、`--color-paper #efe9e4`、`--color-paper-dim #d7cfc9`、`--color-ink-on-paper #2a232b`、`--color-flower #a184c9`；
4. 对比度守门（测试内自带相对亮度函数，不引依赖）：`ink/night ≥ 4.5`、`ink-dim/night ≥ 4.5`、`primary/night ≥ 4.5`、`flower/night ≥ 4.5`、`ink-on-paper/paper ≥ 4.5`、`line-strong/night ≥ 3`；并**显式断言 `ink-mute/night < 4.5`**，把「不可用于小号正文」变成测试事实，防止后续误用；
5. 断言 `@theme` 内无 `--color-vine`（此条先 `skip`，步骤 3 / P7 打开——用 `it.todo` 或分阶段断言，避免红着过夜）。

**实现（绿）** —— `app/globals.css`：

1. `@theme` 增补语义 token（颜色 / `--font-mono` / `--text-h3` / `--text-label` / `--tracking-label` / 四档圆角 / `--shadow-overlay` / `--duration-*` / `--ease-out-quart` / `--animate-enter`），按 PRD §3.1–3.5 改值；
2. 关键副作用要在 PR 里写明：`--radius-md: 8px` 会把全站既有 `rounded-md` 从 6px 变为 8px（后台表格/按钮会一并变化，属预期）；`--font-mono` 覆盖 Tailwind 默认 mono 栈，弹幕时间、日历 `tabular-nums`、周表刻度会换字形，需回归这三处；
3. 基础层：`body` 用 token、`::selection` 用 `color-mix(in oklab, var(--color-flower) 45%, transparent)`、`:focus-visible { outline: 2px solid var(--color-flower); outline-offset: 2px }`；
4. 全局 reduced-motion 兜底（提案 §4.5 的 `!important` 块）替换原 `:169–176` 的「仅弹幕降级」；删掉注释里的「公开站不降级」口径；
5. `@keyframes rise` → `enter`（`480ms`，位移 `8px`），对应 `--animate-enter`；`danmaku-flash` 的硬编码色改 `color-mix(in oklab, var(--color-flower) 15%, transparent)`；`--animate-pulse` 保留。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/design-tokens.test.ts` 绿；`pnpm -C apps/bookstore build` 通过；肉眼确认导航/页脚颜色变化符合预期（此时结构未动）。

---

### 步骤 2（P0b）：全仓 `vine` → `line` 机械替换

**单测先行（红）** —— `tests/unit/nav-bar.test.tsx:165` 改为断言新滚动线类（`border-line` 或 `bg-line`），先红。

**实现（绿）** —— 一次性机械替换，**只改类名不改结构**，映射如下：

| 旧 | 新 | 说明 |
|----|----|------|
| `border-vine` / `border-vine/50` / `border-vine/40` | `border-line` | 结构线、卡片描边 |
| `border-vine`（输入框、按钮、分隔控件边界） | `border-line-strong` | 控件边界需 ≥3:1 |
| `divide-vine/20` | `divide-line` | 列表行 |
| `text-vine`（图标、装饰） | `text-line-strong` | 图标不再是「藤蔓色」 |
| `text-vine`（文字） | `text-ink-dim` | 文字不用结构线色 |
| `bg-vine`（历史条目圆点） | `bg-line-strong` | 仍需可见的小色块 |
| `bg-vine/70`（检索结果左竖条） | `bg-line-strong` | 纯装饰竖条 |
| `shadow-[0_1px_0_0_var(--color-vine)]` | `border-b border-line` | 滚动线改用真边框 |
| `<PaperCard>` 角饰里的 `text-vine` | 随组件删除 | 步骤 8 |

执行顺序：先 `app/components` 再 `features` 再 `tests`，按目录分 3 个提交，便于逐段审阅。**不要删 `--color-vine`**（`.vine-draw` 还在用）。

**验证**：`grep -rnE "(border|text|bg|divide|shadow)-vine" apps/bookstore/{app,components,features,lib}` 零命中；`pnpm lint && pnpm test && pnpm build` 绿；页面边线全部仍在（抽查首页、后台登录、弹幕看板、周表弹窗、棉花糖）。

---

### 步骤 3（P1）：Primitive / Pattern 层与 focus trap（TDD）

**单测先行（红）** —— 新增：

| 测试 | 覆盖点 |
|------|--------|
| `ui-button.test.tsx` | 四变体类名、`sm/md` 高度、`href` 渲染 `<a>`（含 `download`/`target`/`rel` 透传）、`loading` 禁用 + `aria-busy` + 文案「处理中…」、`disabled` 不可点击、`icon` 位置 |
| `ui-field.test.tsx` | `label` 与 `id` 关联（`useId`）、`error` 渲染 `role="alert"` + `aria-invalid` + `aria-describedby`、`hint`、`disabled`；`TextareaField` / `SelectField` 同壳层 |
| `ui-primitives.test.tsx` | `Tag`（span/button 两态）、`Surface`（三变体 × 三档 padding、无阴影类）、`Notice`（info/warning 左线色）、`Rule`（带/不带 label）、`EmptyState`（标题/说明/动作） |
| `ui-plate.test.tsx` | `figure` + `figcaption` 结构、`as="div"` 不产生 `figcaption`、题注文本含编号、`fit="contain"` 内衬、`priority`/`sizes` 透传、无 `rounded-lg`/`shadow` |
| `patterns-timeline.test.tsx` | `<ol>/<li>/<time dateTime>`、日期列与内容列、`current` 标记、移动端单列类 |
| `layout-shell.test.tsx` | `PageShell` 的 `wide/prose` 版心、`withNavOffset`、桌面装订线类；`PageHeader`/`SectionHeader` 的 eyebrow/folio/title/lead/actions、`SectionHeader as="h1"` 时唯一 `h1` |
| `lib-focus-trap.test.tsx` | `focusablesIn` 过滤隐藏/禁用元素；`useFocusTrap` 打开时首元素聚焦、Tab 末尾回卷、Shift+Tab 开头回卷、关闭后焦点回到触发元素；`lockScroll` 时 `body.style.overflow` 置 `hidden` 并复原 |

**实现（绿）** —— 目录与 API：

```text
components/ui/{Button,Field,Tag,Surface,Notice,Plate,Rule,EmptyState}.tsx
components/layout/{PageShell,PageHeader,SectionHeader}.tsx
components/patterns/Timeline.tsx
lib/useFocusTrap.ts        # focusablesIn（纯函数）+ useFocusTrap
lib/cn.ts                  # 10 行类名合并，零依赖
```

- **`Button`**：`variant/size/loading/icon/iconPosition/href`，`href` 存在时渲染 `<a>` 且共享类名与焦点态；类名合并走 `cn`；不写十六进制；
- **`Field` / `TextareaField` / `SelectField`**：受控壳层 + `useId`；错误态 `crimson` 描边 + 文案；聚焦 `flower` 1px + 2px `flower/20` 环；
- **`Tag`**：`as="span" | "button"`，高 30px（移动 36px），4px 圆角；
- **`Surface`**：`variant="raised|outline|paper"`、`padding="none|sm|md|lg"`、2px 圆角、无阴影；
- **`Notice`**：`tone="info|warning"` + 可选 `title`；
- **`Plate`**：见 §2 裁定 7；立绘 `fit="contain"` + `bg-soft` 内衬；hover `opacity .92` + 题注下划线；不加位移/放大/阴影；
- **`Rule`**：1px `line`，可选左端 mono 标签；
- **`EmptyState`**：标题 + 说明 + 一个动作；
- **`PageShell`**：`mx-auto` + `px-5 sm:px-8 lg:px-16` + `py-24 lg:py-32`；`wide=max-w-[88rem]` / `prose=max-w-[44rem]`；`lg:border-l lg:border-line lg:pl-8`（装订线）；`withNavOffset` 控制 `pt` 是否含导航留白；
- **`PageHeader` / `SectionHeader`**：eyebrow（mono/大写/0.12em）+ folio（serif，`primary`）+ 标题（serif 600）+ lead（`ink-dim`，≤38rem）+ actions；底部 1px `line`；
- **`Timeline`**：`items: { key, date, title, note?, current? }[]`，桌面 `8rem` 日期列右对齐，移动单列，日期用 `<time>`；
- **`useFocusTrap`**：`(ref, active, { lockScroll })`；`focusablesIn` 纯函数便于 jsdom 测；不依赖第三方。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/ui-*.test.tsx tests/unit/patterns-timeline.test.tsx tests/unit/layout-shell.test.tsx tests/unit/lib-focus-trap.test.tsx` 全绿；`pnpm lint && pnpm build` 通过（组件尚未接线，构建应无未使用报错）。

---

### 步骤 4（P2）：全局壳 —— NavBar / Footer / skip link / 404（TDD）

**单测先行（红）**

1. `nav-bar.test.tsx` 重写：64px、活动态 `aria-current="page"` + `primary` 下划线类、滚动后 `bg-night/90 backdrop-blur-md border-b border-line`、移动抽屉 `role="dialog"` + `aria-modal` + `aria-expanded`、打开后 `body.style.overflow === "hidden"`、Esc 关闭、关闭后焦点回到触发按钮、Tab 在抽屉内循环、点击导航项关闭；
2. `footer-link.test.tsx` 重写：三栏结构、六个站点链接（按门控过滤）、四个外链 `rel="noopener noreferrer"` + `ExternalLink` 图标 `aria-hidden`、完整免责声明不截断、无 `.lace-x`、无 `bg-raised` 条、移动单列类；
3. 新增 `site-layout.test.tsx`：`skip link` 为首个可聚焦元素且指向 `#main`、`<main id="main">` 存在、每页唯一 `h1`（404 页）；
4. `not-found` 断言：`404` 文本 `aria-hidden` 且 `font-mono`、`h1` 承载语义、无内联径向渐变、有「返回首页」链接。

**实现（绿）**

- `components/NavBar.tsx`：保留 `buildBaseLinks` / `NAVIGATE_EVENT` / hash 同步 / 门控逻辑（数据源一行不改）；换视觉与抽屉：全屏 `night` 底、`text-h2` 列表、底部小号版权行；滚动线改 `border-b border-line`；活动态 `text-ink` + `after:` 1px `primary`（距文字 6px）；字号降为 `1rem`；接 `useFocusTrap`；
- `components/Footer.tsx`：三栏（站点说明 / 导航 / 关注）+ 顶部 1px `line`；导航列由 `SECTIONS` + 门控派生；外链统一 `↗`；免责声明完整；移动单列；此步**移除 `.lace-x` 使用但不删 CSS**；
- `app/(site)/layout.tsx`：`<a href="#main" className="sr-only focus:not-sr-only …">跳到正文</a>` + `<main id="main">`；
- `components/NotFoundPage.tsx`：`font-mono` 大号 404（`aria-hidden`）+ `h1` + 说明 + `Button` 返回；
- 后台守卫复用的 404 自动继承新样式（`app/backdoor/layout.tsx` 不改）。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/nav-bar.test.tsx tests/unit/footer-link.test.tsx tests/unit/site-layout.test.tsx` 绿；`pnpm lint && pnpm test && pnpm build`；键盘实测：Tab 首下到 skip link → 导航 → 内容 → 页脚；移动抽屉 Esc/焦点/滚动锁。

**PR1 收尾**：截图（导航默认/滚动/抽屉、页脚、404）+ 组件样品页（临时路由不做，直接用测试与概念页对照）；`rg` 确认无 `-vine` 类。

---

### 步骤 5（P3）：首页 deck 与共享档案组件（TDD）

这是本期最大的一步，按「纯函数 → 组件 → 页面装配」推进。

**5.1 PageIndex（纯函数先行）**

- 新 `features/home/pageIndex.ts`：`indexEntries(sections)` → `{ id, folio, label, hash, isArchiveChild }[]`（folio 取 `["壹","贰","叁","肆","伍","陆","柒","捌"]` 按渲染顺序，不跳号）；`activeEntry(sections, index)` → 条目 id；标签拼接规则：`archive-*` 用 `档案 · ${railLabel}`，其余用 `railLabel ?? title`；
- 测 `home-page-index.test.ts`（由 `home-section-rail.test.ts` 改名）：8 站 / 7 站（无日历）两种序列的 folio 连续、标签正确、`activeEntry` 边界（越界回落 `home`）。

**5.2 PageIndex 组件**

- `features/home/PageIndex.tsx`：`<nav aria-label="页面位置"><ol>`；每项 `<a href={hash}>` + `onClick` 阻止默认 → `onNavigate(index)`；`aria-current="true"`；16px `primary` 横线 + 标签；非当前仅页码 `ink-dim`；hover/focus 显示标签；触达区 ≥44×44；`useMediaQuery("(max-width: 1023px)")` 为真返回 `null`；
- 测 `patterns-page-index.test.tsx`：中文页码、`aria-current`、点击回调、1023 以下不渲染。

**5.3 首页各屏**

- `FullpageDeck.tsx`：删 `GlowParticles` / `SectionRail` / 视差相关 import；换 `PageIndex`；渲染移动端顶部 1px 进度条（`aria-hidden`，宽度 = `index/(len-1)`）；`data-section` 保留；`LockController` 保留；
- `useFullpageScroll.ts`：新增 `reducedMotion`（内部 `useMediaQuery("(prefers-reduced-motion: reduce)")`）；删 `IMPULSE_EVENT` / `SCROLL_IMPULSE_EVENT` / `sumire:flow-scroll` 的派发与导出；`reducedMotion` 时 `goTo` 直接落位（不排 rAF 帧）、内容 `opacity` 120ms；非 reduced 用 480ms；手势聚合/边界/free-deck/hash 同步**一行不改**；
- 测 `home-fullpage-scroll.test.tsx` 补：reduced 下不产生 rAF、无事件派发；非 reduced 时长 480ms；
- `HeroSection.tsx`：删两处 `.fog` 与 `ParallaxLayer`；`lg:grid-cols-12`（左 `col-span-5`、图版 `col-span-6 col-start-7`）；竖排书名 `[writing-mode:vertical-rl] max-lg:[writing-mode:horizontal-tb]` + `@supports` 回退；`Sumire` 置于书名右下；元数据行（直播点 + 今日日程，行内，1px 下划线）；背景一处静态径向 `primary/6%`；入场只保留标题 + 简介 `fade + 8px`；
- `LiveStatus.tsx` / `TodaySchedule.tsx`：改为行内紧凑形态（去掉药丸/卡片），保留 `API_CONFIGURED` 守卫、固定尺寸骨架、pulse 点、无计划空态；更新 `home-live-status.test.tsx` / `home-today-schedule.test.tsx` / `home-live-status-api.test.ts`（**「今日日程」标题删除**，e2e 同步）；
- `SplitSection.tsx` 重写：删除 `heroMobilePortrait`、全部 `ParallaxLayer`、毛玻璃浮层；固定「文字左 `col-span-6` / 图版右 `col-span-5 col-start-8`」；移动单列「图版 `40svh` 在上、文字在下」；保留 `anchorContentBottom` 与 `data-fullpage-scrollable`；
- `ArchiveSection.tsx`：`portraitLeft` 恒 false；保留立绘 cycle（P1/P3/P5→standing-02、P2/P4→standing-01）；每屏 `SectionHeader`（folio 贰~陆）+ `Rule`；P1 `dl` 定义表、P2 宋体正文 + `indent-8` + 2px `primary` 引文、P3 `Tag`、P4 `Timeline`、P5 `Surface` + `Button href`；
- `features/about/parts/*` 同步迁移（与首页共用）：`ProfilePart`（去 `LaceFrame`、`Plate` 小图版、bare 变体只留表）、`StoryPart`、`TastePart`（`Tag`）、`JourneyPart`（`Timeline`）、`TriviaPart`（`Surface` + `Button href`）；四个 part 内部不再渲染 `SectionTitle`，**标题上移到调用方**（`ArchiveSection` 每屏 / `/about` 每节各渲染一个 `SectionHeader`，保证每节仍有 `h2`，`TriviaPart` 内的「传送门」子标题改 `Rule` 带标签）；删除 `SectionTitle.tsx` 并从 `parts/index.ts` 移除导出；
- `CalendarSection` / `CalendarView` `immersive`：网格 `1px line`、单元格 `rounded-none bg-transparent`、今天 `primary` 圆点 + `primary` 日期、翻月改 44×44 `ghost` 图标按钮（左右 gutter）、摘要时间 `font-mono tabular-nums`；`calendarDrag.ts` / `dateUtils.ts` / `mergeEntries.ts` / `DayDetailDialog` 逻辑不动；
- `AssetsSection` / `AssetGallery`：下划线 tab（`button` + `aria-pressed`，高 44px）、`Plate` 网格 1/2/3/4 列、`object-contain p-4`（立绘）/`object-cover`、hover 只 `opacity` + 题注下划线；Lightbox `night/96` + `Plate` + `Surface` 信息条 + `Button`，接 `useFocusTrap`（保留 Esc/遮罩关闭/滚动锁）；
- **此步删除**：`GlowParticles.tsx`、`glowParticles.ts`、`ParallaxLayer.tsx`、`parallax.ts`、`useParallax.ts`、`SectionRail.tsx`、`sectionRail.ts`、`VineTimeline.tsx`、`LaceFrame.tsx`、`ExternalButton.tsx`、`WeeklySchedule.tsx`、`SectionTitle.tsx`；同步删 `globals.css` 的 `.fog/-a/-b` + `fog-drift`、`.lace-x`、`.vine-draw` + `vine-grow`、`.flower-node`（`.paper` 留到步骤 8）。

**测试动作**：

- 删除 `home-glow-particles.test.ts`、`home-glow-particles-canvas.test.tsx`、`home-parallax.test.ts`、`home-parallax-layer.test.tsx`；
- 改写 `home-visual-fx.test.tsx` 为「断言不存在」（无 `canvas[aria-hidden]`、无 `.fog`、无 `[data-testid=parallax-layer]`、存在 `nav[aria-label="页面位置"]` 的页码、存在 `figure/figcaption` 题注）；
- 改写 `home-deck-sections.test.tsx`：无 `.lace-x`、P1 五屏文字列顺序一致（固定轴）、`SectionHeader` folio 正确、`Timeline` 项数、`Tag` 数；
- 改写 `home-fullpage-deck.test.tsx`：7/8 站序列不变、`PageIndex` 页码点击跳转、移动端进度条存在；
- `home-weekly-guard.test.tsx` 去掉粒子/视差 mock。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/home-*.test.* tests/unit/patterns-page-index.test.tsx tests/unit/about-parts.test.tsx tests/unit/asset-gallery.test.tsx` 全绿；`pnpm lint && pnpm test && pnpm build`；手动走查桌面 1440 / 移动 375 各站翻页、档案 P4 滚动锚定、日历拖拽与弹层、素材 Lightbox。

---

### 步骤 6（P4）：公开内容页 `/about`、`/assets`、`/calendar`（TDD）

**单测先行（红）**：`about-parts.test.tsx` 断言 `PageShell` 版心、`Notice` 取代 `PaperCard`、无 `LaceFrame`/`VineDivider`；`asset-gallery.test.tsx` 断言下划线 tab、`Plate` 题注、Lightbox 焦点陷阱（Tab 循环）与关闭后焦点归还；`calendar-page-guard.test.tsx` 保持守卫断言。

**实现（绿）**

- `app/(site)/(content)/about/page.tsx`：`PageShell width="wide"` + `PageHeader`（eyebrow `PROFILE`、标题「枝堇图鉴」、引文）；五节内容复用首页同源组件；内文测量宽 ≤36rem；删 `VineDivider`；
- `app/(site)/(content)/assets/page.tsx`：`PageShell width="wide"` + `PageHeader`；`PaperCard` → `Notice`；
- `app/(site)/(content)/calendar/page.tsx`：`PageShell width="wide"` + `PageHeader`；未配置 API 仍渲染站点 404（口径不变）；
- **此步删除**：`components/PaperCard.tsx` + `globals.css` 的 `.paper`。

**验证**：`pnpm -C apps/bookstore vitest run tests/unit/about-parts.test.tsx tests/unit/asset-gallery.test.tsx tests/unit/calendar-page-guard.test.tsx` 绿；三页 375/768/1440 截图；键盘走查筛选与 Lightbox。

---

### 步骤 7（P5）：录播 / 回放 / 棉花糖

**单测先行（红）**：`recordings-page.test.tsx`、`recordings-groups.test.tsx`、`recording-file-actions.test.tsx`、`replay-page.test.tsx`、`flv-player-panel.test.tsx`、`topics-*` 里与类名/空态相关的断言更新；行为断言保持不变（本步骤只换壳与控件）。

**实现（绿）**

- `/recordings`：`PageShell` + `PageHeader`；状态药丸改 `Tag` 语义（保留 `eye` 呼吸点）；分组折叠 `Button ghost`；文件行 hover `bg-soft`；分页 `Button secondary`；空态 `EmptyState`；
- `/recordings/replay`：标题区 `PageHeader`（保留场次信息）；控制条按钮统一 `Button size="sm" variant="ghost"` + `aria-label`；事件列 `Surface outline`；弹幕浮层白字与 canvas 逻辑不动；双全屏状态机不动；
- `/topics`：`PageHeader` + `TopicCard`（`Surface` + `Tag`）+ 表单 `Field` + 弹窗 `Surface` + `Button` + `EmptyState`；
- 全部请求、hooks、状态机、URL 参数、文案不变。

**验证**：`pnpm -C apps/bookstore test` 全绿；`cd tests/e2e && pnpm playwright test src/bookstore/recordings.spec.ts src/bookstore/recordings-replay.spec.ts` 通过。

---

### 步骤 8（P6）：后台（token / 控件 / 壳层，不改业务布局）

**单测先行（红）**：`backdoor-layout.test.tsx`、`backdoor-sidenav.test.tsx`、`backdoor-rolebadge.test.tsx`、`backdoor-password.test.ts` 中的类名/控件断言更新；`backdoor-require-role.test.tsx` 行为断言不动。

**实现（绿）**

- `TopBar`：56px + `bg-raised` + 底部 1px `line`；右侧用户/角色 `font-mono text-label`；
- `SideNav`：200px + 右 1px `line`；活动态 `bg-soft` + 左 2px `primary`；删装饰线；
- `LoginCard` / `ChangePasswordCard`：`Surface raised` + 顶部 1px `primary`；`Field` + `Button primary`；错误 `role="alert"`；
- `GuardLoading`：删 `flower-node`，1px 旋转环，reduced-motion 下静态；
- `PrimaryButton` → `Button variant="primary"`；`TextField` → `Field`；`RoleSelect` → `SelectField`；保留组件名做薄封装或直接替换调用点（二选一，全仓统一）；
- 表格（用户管理 / 弹幕检索 / 直播计划）：`Surface` 包一层、表头 `text-label text-ink-dim`、行 `border-b border-line`、hover `bg-soft/60`、危险操作 `text-crimson`；
- 页面级 `border-vine` 已在 P0b 全部替换，本步只调描边粗细、圆角、行高、焦点；
- **不动**：权限、会话、请求、分页、筛选、已读、SSE、弹幕看板布局与交互；后台不画装订线、不用竖排。

**验证**：`cd tests/e2e && pnpm playwright test src/backdoor` 全绿；`pnpm -C apps/bookstore test` 全绿。

---

### 步骤 9（P7）：删除收口、测试收口与文档同步

1. 删除 `--color-vine`（`.vine-draw` 已删，无消费者）与剩余装饰注释；
2. `rg` 零命中门禁：

```bash
grep -rnE "VineDivider|LaceFrame|PaperCard|ExternalButton|VineTimeline|GlowParticles|ParallaxLayer|SectionRail|lace-x|flower-node|vine-draw|fog-drift|vine-grow" apps/bookstore --include='*.ts' --include='*.tsx' --include='*.css' --include='*.md'
grep -rnE "(border|text|bg|divide|shadow)-vine|--color-vine" apps/bookstore
grep -rnE "shadow-\[0_0_|rounded-(xl|2xl)" apps/bookstore/{app,components,features}
```

（`docs/` 下的旧 PRD / 提案不修改，命中允许。）

3. 新增 `tests/e2e/src/bookstore/visual-shell.spec.ts`：375 / 768 / 1440 三档无横向滚动、`main#main` 存在、每页唯一 `h1`、skip link 可聚焦、桌面装订线可见、`PageIndex` 可点击跳转、竖排书名 `writing-mode` 断言（桌面 `vertical-rl` / 移动 `horizontal-tb`）、reduced-motion 下翻页无 `translate3d` 中间帧且无 canvas；
4. e2e 逐条改写（见 §5.4）；
5. 文档同步（见 §7）；
6. 视觉验收：Playwright 三档截图（首页、P1/P4、`/about`、`/assets`、`/calendar`、`/recordings`、回放、棉花糖、后台登录 + 仪表盘），附在 PR 描述；不做 `toHaveScreenshot` 基线；
7. 性能与 a11y 记录：`pnpm build` 对比首屏 JS（应不增）、Lighthouse 移动端 Performance ≥90 / Accessibility ≥95、320px 与 200% 缩放无横向滚动。

**验证**：`pnpm -C apps/bookstore lint && pnpm -C apps/bookstore test && pnpm -C apps/bookstore build`；`cd tests/e2e && pnpm playwright test`；三条 `grep` 零命中。

## 5. 删除与迁移映射

### 5.1 删除文件（按步骤）

| 步骤 | 文件 | 最后一个消费者 |
|------|------|----------------|
| P3 | `features/home/GlowParticles.tsx`、`glowParticles.ts` | `FullpageDeck` |
| P3 | `features/home/ParallaxLayer.tsx`、`parallax.ts`、`useParallax.ts` | `HeroSection`、`SplitSection` |
| P3 | `features/home/SectionRail.tsx`、`sectionRail.ts` | `FullpageDeck` |
| P3 | `features/home/WeeklySchedule.tsx` | 无（已无引用） |
| P3 | `features/about/VineTimeline.tsx` | `JourneyPart` |
| P3 | `components/LaceFrame.tsx` | `ProfilePart` |
| P3 | `components/ExternalButton.tsx` | `TriviaPart` |
| P3 | `features/about/parts/SectionTitle.tsx` | `about/parts/*` |
| P4 | `components/PaperCard.tsx` | `/assets` |
| P7 | `--color-vine` | 无 |

### 5.2 新增 / 改名

| 旧 | 新 |
|----|----|
| `features/home/SectionRail.tsx` | `features/home/PageIndex.tsx` |
| `features/home/sectionRail.ts` | `features/home/pageIndex.ts`（`indexEntries` / `activeEntry`） |
| — | `components/ui/{Button,Field,Tag,Surface,Notice,Plate,Rule,EmptyState}.tsx` |
| — | `components/layout/{PageShell,PageHeader,SectionHeader}.tsx` |
| — | `components/patterns/Timeline.tsx` |
| — | `lib/useFocusTrap.ts`、`lib/cn.ts` |
| — | `tests/unit/design-tokens.test.ts` 等 §4 步骤 3 所列 |

### 5.3 CSS / 类名映射

| 旧 | 新 |
|----|----|
| `border-vine*` | `border-line` / 控件边界 `border-line-strong` |
| `text-vine` | `text-line-strong`（图形）/ `text-ink-dim`（文字） |
| `bg-vine*` | `bg-line` / 指示点 `bg-line-strong` |
| `divide-vine/20` | `divide-line` |
| `rounded-lg`（卡片/图版） | `rounded-xs`（2px） |
| `rounded-full`（按钮/筛选/标签） | `rounded-md`（8px）/ 标签 `rounded-sm`（4px）；仅状态药丸 `rounded-pill` |
| `shadow-[0_0_18px…]`、`shadow-[0_10px_40px…]` | 删除（弹层用 `shadow-overlay`） |
| `hover:-translate-y-0.5`、`hover:scale-[1.03]` | 删除，改 `opacity` |
| `font-display text-sm italic tracking-widest`（章节标签） | `font-mono text-label tracking-label uppercase` |
| `text-4xl font-bold` | `text-h1 font-semibold` |

### 5.4 e2e 逐条改写

| 用例 | 现状 | 改为 |
|------|------|------|
| `site-home-indicator`（`:54`） | SectionRail 仅圆点 | `PageIndex` 页码文本 + `aria-current`「档案 · 信息」 |
| `site-home-today`（`:162`） | 「今日日程」标题 | 元数据行：`直播中/未开播` + `HH:mm 主题` 文本存在，无 `h*` 标题 |
| `site-home-visual-fx`（`:167`） | canvas + 视差存在 | `canvas` 计数 0、`.fog` 计数 0、`[data-testid=parallax-layer]` 计数 0、图版题注存在 |
| `site-home-archive-parallax-overscan`（`:177`） | 视差外扩几何 | 删除（能力已移除） |
| `site-home-visual-fx-reduce`（`:212`） | reduced 下粒子/雾不降级 | reduced 下无 canvas/雾；500px 滚轮后 hash 前进且转场 ≤120ms 或无位移；`emulateMedia` 仍保留 |
| `site-home-archive-bleed`（`:251`） | 立绘出血至窗口底边 gap=0 | 图版与内容列间距 ≥24px、图版 1px 描边可见、图版不超出 `main` 水平边界 |
| `site-home-archive-webp`（`:230`） | 立绘无 404 | 保留（图片源不变，仅容器换 `Plate`） |
| `calendar-immersive-bars`（`calendar.spec:122`） | 全高翻月竖条 | 44×44 图标按钮 `aria-label="上一月/下一月"` 可点且滚动宽度不变 |
| `backdoor/topics.spec` 结构选择器 | `border-vine` 类 | 新结构（`Surface` 容器 + 1px `line`） |
| 新增 `visual-shell.spec.ts` | — | 见 §4 步骤 9 |

## 6. 测试矩阵

| 层 | 新增 | 更新 | 删除 |
|----|------|------|------|
| Token | `design-tokens.test.ts` | — | — |
| Primitive | `ui-button`、`ui-field`、`ui-primitives`、`ui-plate` | `footer-link`（页脚） | — |
| Pattern | `layout-shell`、`patterns-timeline`、`patterns-page-index`、`lib-focus-trap` | `nav-bar` | — |
| 首页 | `home-page-index`（改名） | `home-fullpage-deck`、`home-fullpage-scroll`、`home-visual-fx`、`home-deck-sections`、`home-weekly-guard`、`home-live-status*`、`home-today-schedule` | `home-glow-particles`、`home-glow-particles-canvas`、`home-parallax`、`home-parallax-layer` |
| 内容页 | — | `about-parts`、`asset-gallery`、`schedule-calendar-view`（今天标记） | — |
| 录播 / 棉花糖 | — | `recordings-page`、`recordings-groups`、`recording-file-actions`、`replay-page`、`flv-player-panel`、`topics-*` | — |
| 后台 | — | `backdoor-layout`、`backdoor-sidenav`、`backdoor-rolebadge`、`backdoor-password` | — |
| e2e | `visual-shell.spec.ts` | `site.spec.ts`、`calendar.spec.ts`、`backdoor/topics.spec.ts` | — |

> 每个组件测试只断言「结构 + 可访问性 + 状态类名」，不断言像素；视觉验收走截图，不进 CI。

## 7. 文档同步（同一实现 PR 内）

| 文档 | 更新点 |
|------|--------|
| `docs/design/01-visual-identity.md` | 重写概念、色板、字阶、图形语言（删藤蔓/蕾丝/纸页角饰/花节点）、动效口径（全站 reduced-motion） |
| `docs/design/02-page-design.md` | 重写页面骨架、导航、页脚、首页 deck、档案、素材、日历 |
| `docs/design/03-backdoor-design.md` | token、控件、壳层；删装饰线；保留后台 reduced-motion |
| `docs/product/spec/site-pages.md` | 全局视觉、首页/档案/素材组件与动效；删粒子/视差/雾/树状索引 |
| `docs/product/spec/calendar.md` | 日历网格、今天标记、翻月按钮 |
| `docs/engineering/spec/frontend-bookstore.md` | 设计系统分层、组件目录、token、reduced-motion、删除的模块 |
| `docs/engineering/frontend-rules.md` | token 列表、圆角/描边/焦点/动效规范；删除「公开站不降级」例外 |
| `apps/bookstore/AGENTS.md` | 组件目录、设计系统约定、删除的组件与事件、`Home` 氛围段整体改写 |

归档：本期上线后，PRD / 提案按各自目录的归档规则移入 `archived/`（只移动不修改）。

## 8. 风险与缓解（按实际规模）

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| `vine` 扫漏（70 文件 / 198 处，含后台内联控件） | 中 | 局部掉边线、风格不统一 | P0b 按目录分提交 + `grep` 零命门禁 + 页面盘点表逐页勾选 |
| token 删除早于消费者，Tailwind 静默丢弃类 | 中 | 中间提交页面崩边 | 已按「随最后一个消费者删除」排期（§2 裁定 3） |
| `--radius-md` 6→8px、`--font-mono` 全局覆盖 | 高 | 后台与弹幕看板字形/圆角变化 | 在 PR1 描述里明示；步骤 8 全跑后台 e2e；弹幕/日历/周表抽三处字形回归 |
| archived 页面遗漏（8 站 + 6 条路由 + 后台 10 页） | 中 | 个别页面仍是旧风格 | 步骤 9 的「页面盘点表」逐页勾；三档截图清单同表 |
| 删除粒子/视差被评审否决 | 中 | 需回退方案 | 决策点 1/2 已在 PRD §九；若否决，仅恢复 `GlowParticles`/`ParallaxLayer` 两个文件与事件派发，token 与页面不受影响（保留在 PR 历史） |
| 竖排书名在窄屏/不支持浏览器错位 | 低 | 首屏怪异 | `max-lg` 横排 + `@supports` 回退；375px 截图必过 |
| reduced-motion 全局 `!important` 误伤 | 低 | 个别过渡失效 | 已确认无 JS 依赖 `transitionend`；弹幕定位闪光的显式降级保留 |
| PR 过大难评审 | 高 | 周期长 | 3 个 PR + 分目录提交 + 截图清单；PR2 按「纯函数 → 组件 → 页面」顺序便于分段读 |
| 视觉回归全靠肉眼 | 中 | 漏改 | 三档截图 + `visual-shell.spec.ts` 结构断言 + token 测试，不引入像素基线 |

**回滚**：未合 `main` 前，按 PR 粒度 revert（3 个 PR 独立）；本期不改数据库/契约，无数据回滚。

## 9. 验收对照（PRD §八）

| PRD 条目 | 落点 |
|----------|------|
| A1 token 全量 + `vine` 移除 | 步骤 1、2、9；`design-tokens.test.ts` + grep 门禁 |
| A2 四档圆角、A3 仅弹层阴影、A6 结构线 | 步骤 1、3、5；`ui-primitives` 断言 + grep |
| A4 `font-display` 收窄 | 步骤 3、5（NavBar 字标 / `Plate` 编号 / 卷次） |
| A5 统一 `PageShell` | 步骤 3、5、6 |
| B1 装饰组件删除 | 步骤 5、6、9 |
| B2 装饰 CSS 删除 | 步骤 5（lace/fog/vine/flower-node）、6（paper）、9（`--color-vine`） |
| B3 无 Canvas / 视差，B4 页脚无蕾丝、404 无紫光，B5 时间线无藤蔓 | 步骤 4、5 |
| C1–C10 页面 | 步骤 4（C1/C2/C10）、5（C3/C4/C6/C7）、6（C5/C7）、7（C8）、8（C9） |
| D1–D6 可访问性 | 步骤 3（焦点/触摸）、4（skip link/抽屉）、5–8（弹层焦点）、9（e2e） |
| E1–E6 工程 | 每步 `lint/test/build`；步骤 9 收口 + 文档同步 |

## 10. 相关文档

- 概念页（评审样品）：`docs/design/2026-11-01-visual-system-concept.html`
- 关联 PRD：`docs/product/requirements/draft/2026-11-01-visual-system-redesign-prd.md`
- 关联技术提案：`docs/engineering/proposals/2026-11-01-visual-system-redesign-proposal.md`
- 视觉识别（现态）：`docs/design/01-visual-identity.md`、`02-page-design.md`、`03-backdoor-design.md`
- 产品 spec：`docs/product/spec/site-pages.md`、`docs/product/spec/calendar.md`
- 技术 spec：`docs/engineering/spec/frontend-bookstore.md`
- 前端规范：`docs/engineering/frontend-rules.md`、`apps/bookstore/AGENTS.md`
