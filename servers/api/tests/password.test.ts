import { describe, it, expect } from "vitest";
import { validateStrength, hashPassword, verifyPassword } from "../src/auth/password";

describe("validateStrength", () => {
  it("接受长度≥12且含字母、数字、符号的密码", () => {
    const r = validateStrength("Abcdef12345!@#");
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("长度不足 12 被拒", () => {
    const r = validateStrength("Ab1!def");
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("密码长度至少 12 位");
  });

  it("缺字母被拒", () => {
    const r = validateStrength("123456789012!@");
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("密码需包含字母");
  });

  it("缺数字被拒", () => {
    const r = validateStrength("abcdefghijk!@");
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("密码需包含数字");
  });

  it("缺符号被拒", () => {
    const r = validateStrength("Abcdefghijk123");
    expect(r.ok).toBe(false);
    expect(r.errors).toContain("密码需包含符号");
  });

  it("多个缺失项同时报出", () => {
    const r = validateStrength("abcdef");
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(1);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("哈希后可正确校验", async () => {
    const h = await hashPassword("Abcdef12345!@#$%");
    expect(h).not.toContain("Abcdef12345!@#$%");
    expect(await verifyPassword("Abcdef12345!@#$%", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
});
