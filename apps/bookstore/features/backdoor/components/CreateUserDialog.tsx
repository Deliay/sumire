"use client";

import { useState, type FormEvent } from "react";
import { createUser, type Role } from "@/features/backdoor/api";
import TextField from "@/features/backdoor/components/TextField";
import PrimaryButton from "@/features/backdoor/components/PrimaryButton";
import PasswordRulesHint from "@/features/backdoor/components/PasswordRulesHint";
import RoleSelect from "@/features/backdoor/components/RoleSelect";
import { creatableRoles } from "@/features/backdoor/roleAccess";

interface CreateUserDialogProps {
  /** 当前用户角色，用于限定可选角色范围 */
  role: Role;
  open: boolean;
  onClose: () => void;
  /** 创建成功后回调（供父级刷新用户列表） */
  onCreated?: () => void;
}

/** 增加用户 dialog：用户名 + 初始密码（含强度提示）+ 角色选择。 */
export default function CreateUserDialog({ role, open, onClose, onCreated }: CreateUserDialogProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("member");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const options = creatableRoles(role);

  if (!open) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setSuccess("");
    const { status, data } = await createUser(username, password, selectedRole);
    setLoading(false);
    if (status === 201 && "ok" in data && data.ok) {
      setSuccess(`已创建 ${data.username}（${data.role}），请告知其初始密码并提醒首次登录改密`);
      setUsername("");
      setPassword("");
      setSelectedRole("member");
      onCreated?.();
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-vine/50 bg-raised p-7 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 id="create-user-title" className="font-serif text-xl font-semibold text-ink">
            增加用户
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-dim transition-colors hover:text-ink"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
        <p className="mt-1 text-sm text-ink-dim">
          新钥匙由你发放，请让对方首次进入时自行更换
        </p>
        <div className="mt-5 flex flex-col gap-4">
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
            <RoleSelect value={selectedRole} onChange={setSelectedRole} options={options} />
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
  );
}
