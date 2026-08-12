/**
 * 密码强度校验与哈希。
 * 规则：长度 ≥ 12，且同时包含字母（a-zA-Z）、数字（0-9）、符号（字母数字外可见字符）。
 */
export interface StrengthResult {
  ok: boolean;
  errors: string[];
}

const hasLetter = (s: string) => /[a-zA-Z]/.test(s);
const hasDigit = (s: string) => /[0-9]/.test(s);
const hasSymbol = (s: string) => /[^a-zA-Z0-9]/.test(s);

export function validateStrength(password: string): StrengthResult {
  const errors: string[] = [];
  if (password.length < 12) errors.push("密码长度至少 12 位");
  if (!hasLetter(password)) errors.push("密码需包含字母");
  if (!hasDigit(password)) errors.push("密码需包含数字");
  if (!hasSymbol(password)) errors.push("密码需包含符号");
  return { ok: errors.length === 0, errors };
}

import bcrypt from "bcryptjs";

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 10);

export const verifyPassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);
