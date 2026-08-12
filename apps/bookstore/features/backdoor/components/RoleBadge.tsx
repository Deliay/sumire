import type { Role } from "@/features/backdoor/api";
import { ROLE_LABEL } from "@/features/backdoor/roleLabels";

const STYLES: Record<Role, string> = {
  superadmin: "border-flower text-flower",
  admin: "border-primary text-primary",
  member: "border-vine text-ink-dim",
};

/** 角色胶囊标签：按层级用不同描边色（不铺色），显示中文角色名。 */
export default function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${STYLES[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}
