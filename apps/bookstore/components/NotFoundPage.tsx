import Link from "next/link";

/**
 * 站点风格 404 页：仅用 `@theme` token 色，无氛围动效。
 * 用于未匹配路由（根级 `app/not-found.tsx`）与后台未配置 API 基址时的守卫回退。
 */
export default function NotFoundPage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-5 px-5 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 40rem 26rem at 50% 42%, rgb(139 95 214 / 0.10), transparent 70%)",
        }}
      />
      <p className="font-display text-6xl italic text-primary">404</p>
      <h1 className="font-serif text-2xl font-semibold tracking-wider text-ink">
        页面不存在
      </h1>
      <p className="text-sm text-ink-dim">你走进了书架间不存在的角落</p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center gap-1 text-sm text-ink-dim transition-colors hover:text-flower"
      >
        返回首页
      </Link>
    </div>
  );
}
