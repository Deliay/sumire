import { describe, it, expect } from "vitest";
import { canCreate, isRole, atLeast } from "../src/rbac/roles";
import { requireRole } from "../src/rbac/requireRole";
import type { Request, Response } from "express";

describe("canCreate 角色降级规则", () => {
  it("superadmin 可创建任意角色", () => {
    expect(canCreate("superadmin", "superadmin")).toBe(true);
    expect(canCreate("superadmin", "admin")).toBe(true);
    expect(canCreate("superadmin", "member")).toBe(true);
  });

  it("admin 仅可创建 member", () => {
    expect(canCreate("admin", "member")).toBe(true);
    expect(canCreate("admin", "admin")).toBe(false);
    expect(canCreate("admin", "superadmin")).toBe(false);
  });

  it("member 无创建能力", () => {
    expect(canCreate("member", "member")).toBe(false);
    expect(canCreate("member", "admin")).toBe(false);
    expect(canCreate("member", "superadmin")).toBe(false);
  });
});

describe("isRole", () => {
  it("识别合法角色", () => {
    expect(isRole("superadmin")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("member")).toBe(true);
  });

  it("拒绝非法角色", () => {
    expect(isRole("root")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(42)).toBe(false);
  });
});

describe("atLeast 层级判定", () => {
  it("superadmin 满足任意要求", () => {
    expect(atLeast("superadmin", "superadmin")).toBe(true);
    expect(atLeast("superadmin", "admin")).toBe(true);
    expect(atLeast("superadmin", "member")).toBe(true);
  });

  it("admin 满足 admin/member 但不满足 superadmin", () => {
    expect(atLeast("admin", "admin")).toBe(true);
    expect(atLeast("admin", "member")).toBe(true);
    expect(atLeast("admin", "superadmin")).toBe(false);
  });

  it("member 仅满足 member", () => {
    expect(atLeast("member", "member")).toBe(true);
    expect(atLeast("member", "admin")).toBe(false);
  });
});

type MockRes = Response & {
  statusCode: number | null;
  body: unknown;
};

function mockRes(): MockRes {
  const res = {
    statusCode: null as number | null,
    body: null as unknown,
    status(code: number) {
      (res as MockRes).statusCode = code;
      return res as MockRes;
    },
    json(body: unknown) {
      (res as MockRes).body = body;
      return res as MockRes;
    },
    setHeader() {
      return res as MockRes;
    },
  } as unknown as MockRes;
  return res;
}

describe("requireRole 权限矩阵", () => {
  it("未登录 → 401", async () => {
    const req = { user: undefined } as unknown as Request;
    let nextCalled = false;
    const res = mockRes();
    requireRole("superadmin")(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it("admin 访问 superadmin 权限 → 403", async () => {
    const req = { user: { userId: "1", username: "a", role: "admin" } } as unknown as Request;
    let nextCalled = false;
    const res = mockRes();
    requireRole("superadmin")(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("member 访问 admin 权限 → 403", async () => {
    const req = { user: { userId: "1", username: "a", role: "member" } } as unknown as Request;
    let nextCalled = false;
    const res = mockRes();
    requireRole("admin")(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it("superadmin 访问 superadmin 权限 → 放行", async () => {
    const req = { user: { userId: "1", username: "a", role: "superadmin" } } as unknown as Request;
    let nextCalled = false;
    const res = mockRes();
    requireRole("superadmin")(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(res.statusCode).toBe(null);
  });

  it("admin 访问 member 权限 → 放行（层级含 admin）", async () => {
    const req = { user: { userId: "1", username: "a", role: "admin" } } as unknown as Request;
    let nextCalled = false;
    const res = mockRes();
    requireRole("member")(req, res, () => {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
  });
});
