import { beforeAll, describe, expect, it } from "vitest";
import {
  request,
  login,
  CookieJar,
  asSuperadmin,
  waitForReady,
  strongPassword,
} from "./client.js";

beforeAll(async () => {
  await waitForReady();
});

const weakPasswords = {
  tooShort: "Ab1!@defg", // 长度 < 16
  noSymbol: "Abcdefghijklmn1234", // 缺符号
  noDigit: "abcdefghijklmno!@", // 缺数字
  noLetter: "1234567890123456!@", // 缺字母
};

/** 创建全新成员账号并登录，返回 jar 与密码（用于改密类用例，不改种子超管）。 */
async function freshMemberAccount(): Promise<{ jar: CookieJar; password: string }> {
  const username = `cp_${Math.random().toString(36).slice(2, 10)}`;
  const password = strongPassword;
  const sa = await asSuperadmin();
  const create = await request("/api/users", {
    method: "POST",
    jar: sa,
    body: { username, password, role: "member" },
  });
  expect(create.status).toBe(201);
  const jar = new CookieJar();
  await login(username, password, jar);
  return { jar, password };
}

describe("change-password", () => {
  it("change-password-200: 改密成功→me.mustChangePassword=false→旧密码登录 401、新密码登录 200", async () => {
    const { jar, password } = await freshMemberAccount();
    const newPassword = strongPassword + "Z9!";
    const username = (await request("/api/auth/me", { jar })).body as { username: string };
    const cp = await request("/api/auth/change-password", {
      method: "POST",
      jar,
      body: { oldPassword: password, newPassword },
    });
    expect(cp.status).toBe(200);
    const me = await request("/api/auth/me", { jar });
    expect((me.body as { mustChangePassword: boolean }).mustChangePassword).toBe(false);

    const oldRes = await login(username.username, password);
    expect(oldRes.status).toBe(401);
    const newRes = await login(username.username, newPassword);
    expect(newRes.status).toBe(200);
  });

  it("change-password-same-as-old: newPassword=oldPassword → 400 文案「新密码不能与原密码相同」", async () => {
    const { jar, password } = await freshMemberAccount();
    const res = await request("/api/auth/change-password", {
      method: "POST",
      jar,
      body: { oldPassword: password, newPassword: password },
    });
    expect(res.status).toBe(400);
    expect((res.body as { error?: string }).error).toBe("新密码不能与原密码相同");
  });

  it("change-password-wrong-old: oldPassword 错误 → 401 文案「原密码错误」", async () => {
    const { jar } = await freshMemberAccount();
    const res = await request("/api/auth/change-password", {
      method: "POST",
      jar,
      body: { oldPassword: "totally-wrong", newPassword: strongPassword + "Z9!" },
    });
    expect(res.status).toBe(401);
    expect((res.body as { error?: string }).error).toBe("原密码错误");
  });
});

describe("password-policy 用例组（改密场景）", () => {
  it.each([
    ["tooShort", weakPasswords.tooShort],
    ["noSymbol", weakPasswords.noSymbol],
    ["noDigit", weakPasswords.noDigit],
    ["noLetter", weakPasswords.noLetter],
  ])("%s: 强度不达标 → 400 且提示对应规则", async (_name, newPassword) => {
    const { jar, password } = await freshMemberAccount();
    const res = await request("/api/auth/change-password", {
      method: "POST",
      jar,
      body: { oldPassword: password, newPassword },
    });
    expect(res.status).toBe(400);
    expect(typeof (res.body as { error?: string }).error).toBe("string");
  });

  it("合规对照: 合规新密码 → 200", async () => {
    const { jar, password } = await freshMemberAccount();
    const res = await request("/api/auth/change-password", {
      method: "POST",
      jar,
      body: { oldPassword: password, newPassword: strongPassword + "Q7@" },
    });
    expect(res.status).toBe(200);
  });
});
