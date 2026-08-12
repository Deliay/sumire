/**
 * 守卫加载态：会话/权限校验完成前的居中紫花微光点 + 提示小字。
 * 后台不使用氛围动效，此加载态为静态呈现。
 */
export default function GuardLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span
          className="inline-block size-4 rounded-full flower-node"
          aria-hidden
        />
        <span className="text-sm text-ink-dim">正在确认身份…</span>
      </div>
    </div>
  );
}
