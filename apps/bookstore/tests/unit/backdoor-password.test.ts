import { describe, it, expect } from "vitest";
import { checkPasswordRules } from "@/features/backdoor/passwordRules";

describe("checkPasswordRules 前端强度实时提示", () => {
  it("全满足时四项均为 true", () => {
    const r = checkPasswordRules("Abcdef12345!@#$%");
    expect(r).toEqual({ length: true, letter: true, digit: true, symbol: true });
  });

  it("长度不足", () => {
    expect(checkPasswordRules("Ab1!de").length).toBe(false);
  });

  it("缺字母", () => {
    expect(checkPasswordRules("1234567890123456!@").letter).toBe(false);
  });

  it("缺数字", () => {
    expect(checkPasswordRules("abcdefghijklmno!@").digit).toBe(false);
  });

  it("缺符号", () => {
    expect(checkPasswordRules("Abcdefghijklmn1234").symbol).toBe(false);
  });

  it("空密码全 false", () => {
    const r = checkPasswordRules("");
    expect(r).toEqual({ length: false, letter: false, digit: false, symbol: false });
  });
});
