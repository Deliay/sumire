# sumire

枝堇Sumire（VirtuaReal 二十八期）非官方粉丝网站 & 工具集。应援色 `#b4a6bf`。

- 站点为非官方粉丝作品，素材版权归主播及所属社团所有；
- 所有内容以官方公开信息为准，禁止二次设定。

## 优先使用 SKILL

在你不确定的时候，优先从已有的 SKILL 中检索知识。有 SKILL 则使用 SKILL。

| Skill | Description |
|------|------|
| z-product | 产品文档创建与生命周期管理 (PRD 工作流) |
| z-project | 项目创建与管理 (monorepo 支持、技术栈选择) |
| z-coding | 契约式开发工作流 (提案、契约、实现) |
| z-git | Git 工作流管理 |
| z-document | 文档规范 (Zettelkasten 方法、Mermaid 图表) |
| z-test | API 测试和 E2E 测试工作流 |
| tdd | 测试驱动开发流程 |
| vercel-react-best-practices | React / Next.js 最佳实践 |
| frontend-design | 前端界面设计规范 |

## 文档结构

- 产品文档：`docs/product/`（生命周期：draft → reviewed → shipping → released）
- 技术方案：`docs/engineering/`
- 设计文档：`docs/design/`（视觉识别与页面设计细节）

## 开发约定

- 分支命名：`<type>/<slug>`（`prd` 文档分支 / `feat` 开发分支），禁止 rebase/squash，只 merge；
- 开发遵循 TDD；写代码前加载对应目录的 AGENTS.md 与相关规范；
- 未上线的功能不得在 UI 中显示占位入口。
