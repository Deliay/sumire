import type { Role } from "@/features/backdoor/api";

export const ROLE_LABEL: Record<Role, string> = {
  superadmin: "超管",
  admin: "管理员",
  member: "成员",
};
