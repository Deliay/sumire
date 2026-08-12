"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/features/backdoor/components/TextField";
import PrimaryButton from "@/features/backdoor/components/PrimaryButton";
import { login } from "@/features/backdoor/api";
import { useSession } from "@/features/backdoor/session";

/** 登录卡片：标识 + 表单 + 固定高度错误区。 */
export default function LoginCard() {
  const router = useRouter();
  const { refresh } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    const { status, data } = await login(username, password);
    setLoading(false);
    if (status === 200 && "ok" in data && data.ok) {
      // 登录成功后刷新会话状态，避免守卫仍按未登录处理而跳回登录页
      await refresh();
      if (data.mustChangePassword) {
        router.replace("/backdoor/change-password");
      } else {
        router.replace("/backdoor");
      }
      return;
    }
    if (status === 429) {
      // 限速提示单独展示，不与凭据错误混淆
      setError("error" in data ? data.error ?? "尝试过于频繁，请稍后再试" : "尝试过于频繁，请稍后再试");
      return;
    }
    setError("账号或密码错误");
    setPassword("");
    // 聚焦密码框
    requestAnimationFrame(() => document.getElementById("password")?.focus());
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border border-vine/50 bg-raised shadow-lg"
      style={{ maxWidth: "22rem" }}
    >
      <div className="h-0.5 rounded-t-xl bg-primary" aria-hidden />
      <div className="flex flex-col gap-5 p-7">
        <div className="flex flex-col gap-1">
          <h1 className="font-serif text-3xl font-semibold text-ink">枝堇</h1>
          <p className="font-display text-primary italic">Backdoor</p>
          <p className="text-sm text-ink-dim">老书屋的里屋 · 仅店主与伙计</p>
        </div>
        <TextField
          id="username"
          label="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <TextField
          id="password"
          label="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          readOnly={loading}
        />
        <PrimaryButton type="submit" loading={loading}>
          登录
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
