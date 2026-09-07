import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveReviewModel } from "../src/topics/reviewWorker";
import { config } from "../src/config";

describe("config.reviewAiModel（SUMIRE_REVIEW_AI_MODEL）", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("未设置 SUMIRE_REVIEW_AI_MODEL 时为 undefined", async () => {
    vi.stubEnv("SUMIRE_REVIEW_AI_MODEL", "");
    const { config: fresh } = await import("../src/config");
    expect(fresh.reviewAiModel).toBeUndefined();
  });

  it("设置 SUMIRE_REVIEW_AI_MODEL 时取该值", async () => {
    vi.stubEnv("SUMIRE_REVIEW_AI_MODEL", "claude-sonnet-4-0");
    const { config: fresh } = await import("../src/config");
    expect(fresh.reviewAiModel).toBe("claude-sonnet-4-0");
  });
});

describe("resolveReviewModel（worker 模型选择）", () => {
  afterEach(() => {
    config.reviewAiModel = undefined;
  });

  it("未设置 MODEL 时 openai 分支用默认 gpt-4o-mini", () => {
    config.reviewAiModel = undefined;
    expect(resolveReviewModel("openai")).toBe("gpt-4o-mini");
  });

  it("未设置 MODEL 时 claude 分支用默认 claude-3-haiku-20240307", () => {
    config.reviewAiModel = undefined;
    expect(resolveReviewModel("claude")).toBe("claude-3-haiku-20240307");
  });

  it("设置 MODEL 时两分支均用指定模型", () => {
    config.reviewAiModel = "gpt-4o";
    expect(resolveReviewModel("openai")).toBe("gpt-4o");
    expect(resolveReviewModel("claude")).toBe("gpt-4o");
  });

  it("未知类型且未设置 MODEL 时回退 openai 默认", () => {
    config.reviewAiModel = undefined;
    expect(resolveReviewModel("other")).toBe("gpt-4o-mini");
  });
});