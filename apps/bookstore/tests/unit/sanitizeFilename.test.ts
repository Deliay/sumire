import { describe, it, expect } from "vitest";
import { sanitizeFilename } from "@/features/topics/components/sanitizeFilename";

describe("sanitizeFilename", () => {
  it("trim 首尾空白", () => {
    expect(sanitizeFilename("  主题标题  ")).toBe("主题标题");
  });

  it("文件系统非法字符替换为 -", () => {
    expect(sanitizeFilename('A/B\\C:*?"<>|D')).toBe("A-B-C-------D");
  });

  it("连续空白折叠为单个空格", () => {
    expect(sanitizeFilename("多  行\n标题\t内容")).toBe("多 行 标题 内容");
  });

  it("结果为空时回退「未命名主题」", () => {
    expect(sanitizeFilename("")).toBe("未命名主题");
    expect(sanitizeFilename("   ")).toBe("未命名主题");
  });
});