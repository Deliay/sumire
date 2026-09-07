import { describe, it, expect } from "vitest";
import { toSingleLinePlainText } from "@/features/markdown/toSingleLinePlainText";

describe("toSingleLinePlainText", () => {
  it("去除标题标记并折叠为单行", () => {
    expect(toSingleLinePlainText("# 主题标题")).toBe("主题标题");
    expect(toSingleLinePlainText("## 二级\n### 三级")).toBe("二级 三级");
  });

  it("保留链接文本、去除 URL", () => {
    expect(toSingleLinePlainText("见 [官网](https://example.com)")).toBe("见 官网");
  });

  it("去除图片标记保留 alt", () => {
    expect(toSingleLinePlainText("![立绘](img.png)")).toBe("立绘");
  });

  it("去除加粗/斜体/行内代码", () => {
    expect(toSingleLinePlainText("**加粗**与*斜体*和`代码`")).toBe("加粗与斜体和代码");
  });

  it("去除引用/列表/任务框标记", () => {
    expect(toSingleLinePlainText("> 引用\n- 列表项\n1. 有序\n- [x] 完成")).toBe(
      "引用 列表项 有序 完成",
    );
  });

  it("多行折叠为单个空格并去除首尾空白", () => {
    expect(toSingleLinePlainText("第一行\n\n第二行")).toBe("第一行 第二行");
  });

  it("空串/纯标记返回空", () => {
    expect(toSingleLinePlainText("")).toBe("");
    expect(toSingleLinePlainText("## ")).toBe("");
  });
});