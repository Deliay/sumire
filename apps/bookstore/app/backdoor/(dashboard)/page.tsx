import VineDivider from "@/components/VineDivider";
import SessionNote from "@/features/backdoor/components/SessionNote";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink">
          欢迎回来，老书屋的店主
        </h1>
        <p className="mt-2 text-ink-dim">
          这里还没有打理的事务——管理功能会陆续搬进来
        </p>
      </div>
      <VineDivider grow={false} />
      <SessionNote />
    </div>
  );
}
