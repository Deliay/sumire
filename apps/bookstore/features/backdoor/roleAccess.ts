import type { Role } from "@/features/backdoor/api";

/** 角色层级：superadmin(2) > admin(1) > member(0)。 */
export const ROLE_RANK: Record<Role, number> = {
  superadmin: 2,
  admin: 1,
  member: 0,
};

/** 某角色在「增加用户」页可创建的候选角色：超管任意、管理员仅成员、成员无。 */
export function creatableRoles(role: Role): Role[] {
  const rank = ROLE_RANK[role];
  if (rank >= 2) return ["superadmin", "admin", "member"];
  if (rank === 1) return ["member"];
  return [];
}

/** 判断某角色是否至少达到指定层级。 */
export function atLeast(role: Role, required: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}
