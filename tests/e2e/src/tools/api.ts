/**
 * e2e 公共工具：API 调用助手与预置账号（globalSetup 准备）。
 */
const API_BASE_URL = process.env.API_BASE_URL ?? "";

export interface Account {
  username: string;
  password: string;
}

export interface PreparedAccounts {
  superadmin: Account;
  admin: Account;
  member: Account;
}

export async function apiRequest(
  path: string,
  method = "GET",
  body?: unknown,
  sid?: string,
): Promise<{ status: number; body: unknown; cookie?: string }> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sid) headers["Cookie"] = `sumire_sid=${sid}`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  return { status: res.status, body: parsed, cookie: res.headers.get("set-cookie") ?? undefined };
}

export function requireApiUrl(): string {
  if (!API_BASE_URL) throw new Error("缺少环境变量 API_BASE_URL");
  return API_BASE_URL;
}
