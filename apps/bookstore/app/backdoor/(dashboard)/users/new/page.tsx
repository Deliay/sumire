"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "@/features/backdoor/session";
import { createUser, type Role } from "@/features/backdoor/api";
import TextField from "@/features/backdoor/components/TextField";
import PrimaryButton from "@/features/backdoor/components/PrimaryButton";
import PasswordRulesHint from "@/features/backdoor/components/PasswordRulesHint";
import RoleSelect from "@/features/backdoor/components/RoleSelect";
import { RequireRole } from "@/features/backdoor/RequireRole";

const RANK: Record<Role, number> = { superadmin: 2, admin: 1, member: 0 };

export default function NewUserPage() {
  const { session } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const me = session.status === "authenticated" ? session.me : null;
  const myRank = me ? RANK[me.role] : 0;
  // 可选角色：超管可建任意；管理员仅成员（admin 可建 member，rank 低于自己的）
  const options: Role[] =
    myRank >= 2
      ? ["superadmin", "admin", "member"]
      : myRank === 1
        ? ["member"]
        : [];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");
    const { status, data } = await createUser(username, password, role);
    setLoading(false);
    if (status === 201 && "ok" in data && data.ok) {
      setSuccess(`已创建 ${data.username}（${data.role}），请告知其初始密码并提醒首次登录改密`);
      setUsername("");
      setPassword("");
      setRole("member");
      return;
    }
    const msg =
      status === 403
        ? "没有创建该角色的权限"
        : "error" in data
          ? data.error ?? "创建失败"
          : "创建失败";
    setError(msg);
  }

  return (
    <RequireRole role="admin">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">增加用户</h1>
          <p className="mt-1 text-ink-dim">
            新钥匙由你发放，请让对方首次进入时自行更换
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-xl border border-vine/50 bg-raised p-7"
        >
          <div className="flex flex-col gap-4">
            <TextField
              id="new-username"
              label="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <TextField
              id="new-password"
              label="初始密码"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <PasswordRulesHint password={password} />
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-ink-dim">角色</span>
              <RoleSelect value={role} onChange={setRole} options={options} />
            </div>
            <PrimaryButton type="submit" loading={loading}>
              创建用户
            </PrimaryButton>
            {success && (
              <p className="text-sm text-ink" role="status">
                {success}
              </p>
            )}
            {error && (
              <p className="text-sm text-flower" role="alert">
                {error}
              </p>
            )}
          </div>
        </form>
      </div>
    </RequireRole>
  );
}
