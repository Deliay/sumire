import type { Role, UserRow } from "@/features/backdoor/api";
import RoleBadge from "@/features/backdoor/components/RoleBadge";

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
    return <div className="text-sm text-ink-dim">正在加载账号…</div>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-vine/50 bg-raised">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-vine/50 text-xs text-ink-dim">
            <th className="px-4 py-3 font-medium">用户名</th>
            <th className="px-4 py-3 font-medium">角色</th>
            <th className="px-4 py-3 font-medium">创建时间</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.username} className="border-b border-vine/20 last:border-0">
              <td className="px-4 py-3 text-ink">{user.username}</td>
              <td className="px-4 py-3">
                <RoleBadge role={user.role as Role} />
              </td>
              <td className="px-4 py-3 text-xs text-ink-dim">
                {formatDate(user.createdAt)}
              </td>
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
    </div>
  );
}
