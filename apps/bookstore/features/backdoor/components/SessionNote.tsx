"use client";

import { useEffect, useState } from "react";

/** 会话有效期小字块：本次登录有效期至（7 天）。 */
export default function SessionNote() {
  const [expire, setExpire] = useState("");

  useEffect(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // 仅初始化一次，读取当前时间计算 7 天后日期
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpire(
      d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }, []);

  return <p className="text-xs text-ink-dim">本次登录有效期至 {expire}</p>;
}
