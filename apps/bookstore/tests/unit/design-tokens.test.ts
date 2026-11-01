import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../app/globals.css"), "utf8");

function tokens(): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
    out.set(match[1]!, match[2]!.trim());
  }
  return out;
}

const map = tokens();
const token = (name: string) => map.get(name);

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const raw = hex.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe("设计 token", () => {
  it("新增语义 token 存在且值正确", () => {
    expect(token("color-line")).toBe("#3a323d");
    expect(token("color-line-strong")).toBe("#75687e");
    expect(token("color-ink-mute")).toBe("#776d78");
    expect(token("font-mono")).toContain("ui-monospace");
    expect(token("text-h3")).toBe("1.25rem");
    expect(token("text-label")).toBe("0.75rem");
    expect(token("tracking-label")).toBe("0.12em");
    expect(token("radius-xs")).toBe("2px");
    expect(token("radius-sm")).toBe("4px");
    expect(token("radius-md")).toBe("8px");
    expect(token("radius-pill")).toBe("999px");
    expect(token("shadow-overlay")).toContain("0 24px 64px");
    expect(token("duration-fast")).toBe("140ms");
    expect(token("duration-base")).toBe("220ms");
    expect(token("duration-slow")).toBe("480ms");
    expect(token("ease-out-quart")).toBe("cubic-bezier(0.22, 1, 0.36, 1)");
    expect(token("animate-enter")).toContain("enter 480ms");
  });

  it("色值调整到位", () => {
    expect(token("color-night")).toBe("#141017");
    expect(token("color-raised")).toBe("#1b1620");
    expect(token("color-soft")).toBe("#262029");
    expect(token("color-ink")).toBe("#e9e2dc");
    expect(token("color-ink-dim")).toBe("#a298a2");
    expect(token("color-paper")).toBe("#efe9e4");
    expect(token("color-paper-dim")).toBe("#d7cfc9");
    expect(token("color-ink-on-paper")).toBe("#2a232b");
    expect(token("color-flower")).toBe("#a184c9");
  });

  it("对比度守门：正文/次级/强调 ≥4.5，结构线 ≥3", () => {
    const night = token("color-night")!;
    expect(contrast(token("color-ink")!, night)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("color-ink-dim")!, night)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("color-primary")!, night)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("color-flower")!, night)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("color-ink-on-paper")!, token("color-paper")!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("color-line-strong")!, night)).toBeGreaterThanOrEqual(3);
  });

  it("ink-mute 不可用于小号正文（<4.5），作为测试事实", () => {
    expect(contrast(token("color-ink-mute")!, token("color-night")!)).toBeLessThan(4.5);
  });

  it("vine token 已移除，装饰 CSS 已清空", () => {
    expect(map.has("color-vine")).toBe(false);
    for (const legacy of ["." + "fog", "." + "lace" + "-x", "." + "vine" + "-draw", "." + "flower" + "-node"]) {
      expect(css).not.toContain(legacy);
    }
    expect(css).not.toContain("vine" + "-grow");
    expect(css).not.toContain("fog" + "-drift");
  });

  it("全站 reduced-motion 兜底存在", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("animation-duration: 0.01ms !important");
  });
});
