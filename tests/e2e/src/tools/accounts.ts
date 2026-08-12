/**
 * 预置账号：由 globalSetup 通过 API 准备并写入临时文件，spec 从共享 JSON 读取。
 * 这样 spec 无需 import global-setup.ts（避免重复执行 setup）。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ACCOUNTS_FILE =
  process.env.E2E_ACCOUNTS_FILE ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.accounts.json");

export interface Account {
  username: string;
  password: string;
}

export interface PreparedAccounts {
  superadmin: Account;
  admin: Account;
  member: Account;
}

export function getAccounts(): PreparedAccounts {
  const raw = readFileSync(ACCOUNTS_FILE, "utf8");
  return JSON.parse(raw) as PreparedAccounts;
}
