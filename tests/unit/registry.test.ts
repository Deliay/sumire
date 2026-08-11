// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getTool, getTools } from "@/lib/tools/registry";

describe("tool registry", () => {
  it("exposes a list of tools", () => {
    expect(Array.isArray(getTools())).toBe(true);
  });

  it("returns undefined for unregistered slugs", () => {
    expect(getTool("does-not-exist")).toBeUndefined();
  });
});
