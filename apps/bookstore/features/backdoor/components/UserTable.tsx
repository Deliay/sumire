import type { Role, UserRow } from "@/features/backdoor/api";
import RoleBadge from "@/features/backdoor/components/RoleBadge";
import Surface from "@/components/ui/Surface";

interface UserTableProps {
  users: UserRow[];
  loading: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 用户管理账号表：用户名 / 角色 / 创建时间。 */
export default function UserTable({ users, loading }: UserTableProps) {
  if (loading) {
    return <div className="text-small text-ink-dim">正在加载账号…</div>;
  }
  return (
    <Surface padding="none" className="overflow-hidden">
      <table className="w-full text-left text-small">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 font-mono text-label font-medium tracking-label uppercase text-ink-dim">用户名</th>
            <th className="px-4 py-3 font-mono text-label font-medium tracking-label uppercase text-ink-dim">角色</th>
            <th className="px-4 py-3 font-mono text-label font-medium tracking-label uppercase text-ink-dim">创建时间</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.username}
              className="border-b border-line transition-colors duration-(--duration-fast) last:border-0 hover:bg-soft/60"
            >
              <td className="px-4 py-3 text-ink">{user.username}</td>
              <td className="px-4 py-3">
                <RoleBadge role={user.role as Role} />
              </td>
              <td className="px-4 py-3 font-mono text-label text-ink-dim">{formatDate(user.createdAt)}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-ink-dim">
                暂无账号
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Surface>
  );
}
