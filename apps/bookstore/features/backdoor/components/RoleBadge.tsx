import type { Role } from "@/features/backdoor/api";
import { ROLE_LABEL } from "@/features/backdoor/roleLabels";

const STYLES: Record<Role, string> = {
  superadmin: "border-flower text-flower",
  admin: "border-primary text-primary",
  member: "border-line text-ink-dim",
};

/** 角色标签：按层级用不同描边色（不铺色），显示中文角色名。 */
export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-label ${STYLES[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
