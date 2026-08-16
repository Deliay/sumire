# 技术方案（Proposal）

Proposal 是**时点文档**：记录做决策时的方案、备选与理由，不随实现演进修改。配套的实现计划放在 `docs/engineering/plans/`。

## 归档规则

满足以下任一条件即归档到 `archived/`：

1. 方案已实现并上线，且其架构/机制已被 `docs/engineering/spec/` 收录（spec 成为现态事实源）；
2. 方案被废弃或取代（在文档头部注明废弃原因与替代文档）。

归档即移动文件，不修改内容；归档后 proposal 只读，后续技术变更改 spec 不改 proposal。
