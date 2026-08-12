const API_BASE_URL = process.env.API_BASE_URL;
const BOOKSTORE_ORIGIN = process.env.BOOKSTORE_ORIGIN ?? "";

if (!API_BASE_URL) {
  throw new Error("缺少环境变量 API_BASE_URL（通过 aspire describe api 获取端点注入）");
}

export interface HttpResponse {
  status: number;
  headers: Headers;
  body: unknown;
}

export class CookieJar {
  private sid: string | undefined;

  get cookieHeader(): string | undefined {
    return this.sid ? `sumire_sid=${this.sid}` : undefined;
  }

  setFrom(headers: Headers): void {
    const setCookie = headers.get("set-cookie");
    if (!setCookie) return;
    const match = setCookie.match(/sumire_sid=([^;]+)/);
    if (match) this.sid = match[1];
  }

  /** 测试用：手工设置一个伪造/已知 sid。 */
  setSid(sid: string): void {
    this.sid = sid;
  }
}

export async function request(
  path: string,
  options: { method?: string; body?: unknown; origin?: string; jar?: CookieJar; headers?: Record<string, string> } = {},
): Promise<HttpResponse> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.origin) headers.set("Origin", options.origin);
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) headers.set(k, v);
  }
  if (options.jar?.cookieHeader) headers.set("Cookie", options.jar.cookieHeader);
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (options.jar) options.jar.setFrom(res.headers);
  return { status: res.status, headers: res.headers, body };
}

export function login(
  username: string,
  password: string,
  jar: CookieJar = new CookieJar(),
  headers?: Record<string, string>,
): Promise<HttpResponse> {
  return request("/api/auth/login", {
    method: "POST",
    body: { username, password },
    jar,
    headers,
  });
}

export async function asSuperadmin(): Promise<CookieJar> {
  const jar = new CookieJar();
  const res = await login("supersumire", "salamander", jar);
  if (res.status !== 200) {
    throw new Error(`无法以超管登录: ${JSON.stringify(res.body)}`);
  }
  return jar;
}

/** 以超管创建指定角色账号并返回其 CookieJar（用于权限矩阵用例）。 */
export async function createRoleAccount(role: string, username: string, password: string): Promise<CookieJar> {
  const sa = await asSuperadmin();
  const res = await request("/api/users", {
    method: "POST",
    jar: sa,
    body: { username, password, role },
  });
  if (res.status !== 201) {
    throw new Error(`创建 ${role} 账号失败: ${JSON.stringify(res.body)}`);
  }
  const jar = new CookieJar();
  const lr = await login(username, password, jar);
  if (lr.status !== 200) {
    throw new Error(`登录 ${role} 账号失败: ${JSON.stringify(lr.body)}`);
  }
  return jar;
}

export const strongPassword = "T_Strong1@x9!zZ42#k";
export const bookstoreOrigin = BOOKSTORE_ORIGIN;

/** 轮询等待服务就绪（GET /api/auth/me 应返回 401 而非网络错误），超时 30s。 */
export async function waitForReady(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`);
      if (res.status >= 200) return;
    } catch {
      // 忽略，继续轮询
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("API 服务 30s 内未就绪");
}
