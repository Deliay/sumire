export type Role = "superadmin" | "admin" | "member";

export const ROLES: Role[] = ["superadmin", "admin", "member"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as string[]).includes(value);
}

/** 角色层级：superadmin(2) > admin(1) > member(0) */
export const ROLE_RANK: Record<Role, number> = {
  superadmin: 2,
  admin: 1,
  member: 0,
};

/**
 * 创建用户时的角色降级规则。
 * superadmin 可创建任意角色（含其他 superadmin）；admin 仅可创建 member；member 无能力。
 */
export function canCreate(creatorRole: Role, targetRole: Role): boolean {
  if (creatorRole === "superadmin") return true;
  if (creatorRole === "admin") return targetRole === "member";
  return false;
}

/** 判断某角色是否至少达到指定层级（用于 requireRole 的最小权限判断）。 */
export function atLeast(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "超管",
  admin: "管理员",
  member: "成员",
};
