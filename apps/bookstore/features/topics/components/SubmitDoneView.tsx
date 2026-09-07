"use client";

import Link from "next/link";

// round 9：done 态移除「再投一条」，改为「查看进行中的棉花糖」链接
export default function SubmitDoneView() {
  return (
    <div className="text-center py-8">
      <h3 className="text-lg font-medium text-flower mb-2">提交成功，感谢你的棉花糖</h3>
      <Link
        href="/topics"
        className="text-sm text-ink-dim hover:text-ink transition-colors duration-150"
      >
        查看进行中的棉花糖
      </Link>
    </div>
  );
}