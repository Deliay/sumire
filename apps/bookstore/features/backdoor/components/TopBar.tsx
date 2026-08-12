import type { Role } from "@/features/backdoor/api";
import { ROLE_LABEL } from "@/features/backdoor/roleLabels";

interface TopBarProps {
  username: string;
  role: Role;
  onLogout: () => void;
}

/** 后台顶部栏：站点名 + 用户名/角色 + 修改密码链接 + 登出。 */
export default function TopBar({ username, role, onLogout }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-vine/50 bg-raised px-5">
      <div className="flex items-baseline gap-2">
        <span className="font-serif text-lg font-semibold text-ink">枝堇 · 后台</span>
        <span className="font-display text-primary italic">Backdoor</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-ink-dim">
          {username} · {ROLE_LABEL[role]}
        </span>
        <a
          href="/backdoor/change-password"
          className="text-ink-dim transition-colors hover:text-flower"
        >
          修改密码
        </a>
        <button
          onClick={onLogout}
          className="text-ink-dim transition-colors hover:text-ink"
        >
          登出
        </button>
      </div>
    </header>
  );
}
