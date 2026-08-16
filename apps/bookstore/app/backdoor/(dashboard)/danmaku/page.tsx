"use client";

import DanmakuDashboard from "@/features/danmaku/components/DanmakuDashboard";

/** 弹幕后台页：复用 (dashboard)/layout.tsx 会话守卫，数据全部客户端拉取。 */
export default function DanmakuPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold text-ink">弹幕后台</h1>
        <p className="mt-1 text-ink-dim">直播间弹幕、醒目留言、礼物与上船一览</p>
      </div>
      <DanmakuDashboard />
    </div>
  );
}
