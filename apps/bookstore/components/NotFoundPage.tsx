import Button from "@/components/ui/Button";

/**
 * 站点风格 404 页：mono 大号 404（aria-hidden）+ h1 语义 + 返回首页。
 * 用于未匹配路由（根级 `app/not-found.tsx`）与后台未配置 API 基址时的守卫回退。
 */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 px-5 text-center">
      <p aria-hidden className="font-mono text-6xl font-medium text-ink-mute">
        404
      </p>
      <h1 className="font-serif text-h2 font-semibold text-ink">页面不存在</h1>
      <p className="text-small text-ink-dim">你走进了书架间不存在的角落</p>
      <Button href="/" variant="secondary" size="sm" className="mt-2">
        返回首页
      </Button>
    </div>
  );
}
