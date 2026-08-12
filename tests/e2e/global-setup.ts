import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { apiRequest, requireApiUrl } from "./src/tools/api.js";

/**
 * 全局准备：通过 API 准备三种已完成改密的角色账号（超管/管理员/成员）。
 * 关键设计：不修改种子超管 supersumire 的密码（保持基态），而是用种子仅用于创建
 * 一个专属 e2e 超管账号，再以该超管创建 admin 与 member。账号带运行标识后缀，
 * 与 tests/api 基态隔离、可重复运行。结果写入 .accounts.json 供 spec 读取。
 */
const RUN = Date.now().toString(36);

const accounts = {
  superadmin: {
    username: `e2e_sa_${RUN}`,
    password: `E2e_Super1@${RUN}x9z!`,
    initialPassword: `E2e_InitSa_${RUN}Z9!`,
  },
  admin: {
    username: `e2e_ad_${RUN}`,
    password: `E2e_Admin1@${RUN}x9z!`,
    initialPassword: `E2e_InitAd_${RUN}Z9!`,
  },
  member: {
    username: `e2e_mb_${RUN}`,
    password: `E2e_Member1@${RUN}x9z!`,
    initialPassword: `E2e_InitMb_${RUN}Z9!`,
  },
};

const ACCOUNTS_FILE =
  process.env.E2E_ACCOUNTS_FILE ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), ".accounts.json");

async function login(username: string, password: string): Promise<string> {
  const res = await apiRequest("/api/auth/login", "POST", { username, password });
  if (res.status !== 200) {
    throw new Error(`login failed for ${username}: ${JSON.stringify(res.body)}`);
  }
  const sid = res.cookie?.match(/sumire_sid=([^;]+)/)?.[1];
  if (!sid) throw new Error(`no session cookie for ${username}`);
  return sid;
}

async function changePassword(sid: string, oldPassword: string, newPassword: string): Promise<void> {
  const res = await apiRequest("/api/auth/change-password", "POST", { oldPassword, newPassword }, sid);
  if (res.status !== 200) {
    throw new Error(`改密失败: ${JSON.stringify(res.body)}`);
  }
}

async function waitForApi(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${requireApiUrl()}/api/auth/me`);
      if (res.status >= 200) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("API 服务 30s 内未就绪");
}

export default async function globalSetup(): Promise<void> {
  requireApiUrl();
  await waitForApi();

  // 种子超管仅用于创建专属 e2e 超管；不改其密码（种子 salamander 保持基态）
  const seedSid = await login("supersumire", "salamander");
  const sa = accounts.superadmin;
  const createSa = await apiRequest("/api/users", "POST", {
    username: sa.username,
    password: sa.initialPassword,
    role: "superadmin",
  }, seedSid);
  if (createSa.status !== 201) {
    throw new Error(`创建 e2e 超管失败: ${JSON.stringify(createSa.body)}`);
  }
  // 新超管初始密码登录 → 改密为最终密码
  const saSid = await login(sa.username, sa.initialPassword);
  await changePassword(saSid, sa.initialPassword, sa.password);

  // 用 e2e 超管创建 admin 与 member，并各自完成改密
  for (const acc of [accounts.admin, accounts.member]) {
    const role = acc === accounts.admin ? "admin" : "member";
    const create = await apiRequest("/api/users", "POST", {
      username: acc.username,
      password: acc.initialPassword,
      role,
    }, saSid);
    if (create.status !== 201) {
      throw new Error(`创建 ${acc.username} 失败: ${JSON.stringify(create.body)}`);
    }
    const sid = await login(acc.username, acc.initialPassword);
    await changePassword(sid, acc.initialPassword, acc.password);
  }

  const prepared = {
    superadmin: { username: sa.username, password: sa.password },
    admin: { username: accounts.admin.username, password: accounts.admin.password },
    member: { username: accounts.member.username, password: accounts.member.password },
  };
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(prepared), "utf8");
}
