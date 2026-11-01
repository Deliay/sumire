/**
 * 守卫加载态：1px 旋转环 + 提示小字。
 * 后台不使用氛围动效，reduced-motion 下静态呈现。
 */
export default function GuardLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <span
          className="inline-block size-4 animate-spin rounded-full border border-line-strong border-t-primary motion-reduce:animate-none"
          aria-hidden
        />
        <span className="text-small text-ink-dim">正在确认身份…</span>
      </div>
    </div>
  );
}
