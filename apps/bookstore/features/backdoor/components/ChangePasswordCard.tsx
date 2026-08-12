"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/features/backdoor/components/TextField";
import PrimaryButton from "@/features/backdoor/components/PrimaryButton";
import PasswordRulesHint from "@/features/backdoor/components/PasswordRulesHint";
import { changePassword } from "@/features/backdoor/api";

interface ChangePasswordCardProps {
  /** true 表示强制改密独立页形态（不渲染后台布局）；false 为日常改密布局内形态。 */
  standalone?: boolean;
}

/** 修改密码卡片：原密码 + 新密码 + 确认 + 强度提示。 */
export default function ChangePasswordCard({ standalone = true }: ChangePasswordCardProps) {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    setLoading(true);
    setError("");
    const { status, data } = await changePassword(oldPassword, newPassword);
    setLoading(false);
    if (status === 200) {
      if (standalone) {
        router.replace("/backdoor");
      } else {
        router.replace("/backdoor");
      }
      return;
    }
    setError("error" in data ? data.error ?? "修改密码失败" : "修改密码失败");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border border-vine/50 bg-raised shadow-lg"
      style={{ maxWidth: "24rem" }}
    >
      {standalone && (
        <div className="rounded-t-xl border-b border-vine/50 bg-paper px-6 py-3 text-sm text-ink-on-paper">
          首次进入里屋，请先换一把自己的钥匙
        </div>
      )}
      <div className="flex flex-col gap-4 p-7">
        <h1 className="font-serif text-2xl font-semibold text-ink">修改密码</h1>
        <TextField
          id="old-password"
          label="原密码"
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <TextField
          id="new-password"
          label="新密码"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PasswordRulesHint password={newPassword} />
        <TextField
          id="confirm-password"
          label="确认新密码"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          required
        />
        <PrimaryButton type="submit" loading={loading}>
          确认修改
        </PrimaryButton>
        <div aria-live="polite">
          <p className="min-h-5 text-sm text-flower" role="alert">
            {error}
          </p>
        </div>
      </div>
    </form>
  );
}
