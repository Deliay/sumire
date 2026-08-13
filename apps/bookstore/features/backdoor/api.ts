export type Role = "superadmin" | "admin" | "member";

export interface MeResponse {
  ok: boolean;
  username: string;
  role: Role;
  mustChangePassword: boolean;
}

export interface UserRow {
  username: string;
  role: Role;
  createdAt: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export const API_BASE_URL = BASE_URL;

/** 后台 API 基址是否已配置（非空即已配置）；layout 守卫与请求层共用此判断，避免口径漂移。 */
export const API_CONFIGURED = BASE_URL !== "";

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<{ status: number; data: T }> {
  if (!API_CONFIGURED) {
    return { status: 0, data: null as unknown as T };
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  return { status: res.status, data: data as T };
}

export interface ApiError {
  error?: string;
}

export async function login(
  username: string,
  password: string,
): Promise<{ status: number; data: MeResponse | ApiError }> {
  return request<MeResponse | ApiError>("/api/auth/login", {
    method: "POST",
    body: { username, password },
  });
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

export async function fetchMe(): Promise<{ status: number; data: MeResponse }> {
  return request<MeResponse>("/api/auth/me");
}

export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<{ status: number; data: ApiError | { ok: true } }> {
  return request("/api/auth/change-password", { method: "POST", body: { oldPassword, newPassword } });
}

export async function fetchUsers(): Promise<{ status: number; data: { users: UserRow[] } | ApiError }> {
  return request("/api/users");
}

export async function createUser(
  username: string,
  password: string,
  role: Role,
): Promise<{ status: number; data: { ok: true; username: string; role: Role } | ApiError }> {
  return request("/api/users", { method: "POST", body: { username, password, role } });
}
