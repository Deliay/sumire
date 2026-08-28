import ToolCard from "@/features/danmaku-tools/ToolCard";

export default function DanmakuToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-ink">弹幕工具</h1>
        <p className="mt-2 text-ink-dim">弹幕相关实用工具集合</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          name="弹幕投票"
          description="观众弹幕实时投票统计"
          href="/backdoor/danmaku-tools/vote"
        />
      </div>
    </div>
  );
}
