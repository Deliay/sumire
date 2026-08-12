import type { Role } from "@/features/backdoor/api";

interface RoleSelectProps {
  value: Role;
  onChange: (role: Role) => void;
  /** 可选角色，按当前用户权限限定（超管三选 / 管理员仅成员）。 */
  options: Role[];
}

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "member", label: "成员" },
  { value: "admin", label: "管理员" },
  { value: "superadmin", label: "超级管理员" },
];

/** 角色选择：按权限限定选项。 */
export default function RoleSelect({ value, onChange, options }: RoleSelectProps) {
  if (options.length === 1) {
    return (
      <div className="rounded-md border border-vine/50 bg-soft px-3 py-2 text-sm text-ink-dim">
        角色：{ROLE_OPTIONS.find((o) => o.value === options[0])?.label}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_OPTIONS.filter((o) => options.includes(o.value)).map((opt) => (
        <label key={opt.value} className="cursor-pointer">
          <input
            type="radio"
            name="role"
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="peer sr-only"
          />
          <span className="inline-flex rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors peer-checked:border-primary peer-checked:text-ink">
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  );
}
