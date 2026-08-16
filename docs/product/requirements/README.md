# 产品需求文档（PRD）

PRD 是**时点文档**：记录提出时的需求与验收标准，不随实现演进修改。

## 生命周期

```
draft → reviewed → shipping → released → archived
```

- `draft/`：编写中或待评审。
- `reviewed/`：评审通过，可以进入开发。
- shipping / released：开发中 / 已上线（按需建目录，直接用前缀状态标注亦可，见下）。

目录不足表达时，可在文档头部以 `status:` 字段标注状态。

## 归档规则

满足以下任一条件即归档到 `archived/`：

1. 功能已上线，且其行为已被 `docs/product/spec/` 收录（spec 成为现态事实源）；
2. 需求被废弃或取代（在文档头部注明废弃原因与替代文档）。

归档即移动文件，不修改内容；归档后 PRD 只读，后续行为变更改 spec 不改 PRD。
