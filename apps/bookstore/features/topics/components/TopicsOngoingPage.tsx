"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import PageShell from "@/components/layout/PageShell";
import EmptyState from "@/components/ui/EmptyState";
import Surface from "@/components/ui/Surface";
import { listOngoingTopics } from "@/features/topics/api";
import { toSingleLinePlainText } from "@/features/markdown/toSingleLinePlainText";
import type { TopicPublicInfo } from "@/features/topics/types";

// round 9：公开「进行中的棉花糖」列表页（/topics 无 id 查询串时渲染）
export default function TopicsOngoingPage() {
  const [topics, setTopics] = useState<TopicPublicInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 初始加载：仅在异步回调中 setState（首屏 loading 初值即 true）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status, data } = await listOngoingTopics();
      if (cancelled) return;
      if (status === 200 && data?.ok) {
        setTopics(data.topics);
      } else {
        setError(true);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 失败重试（事件处理器内允许同步 setState）
  const load = async () => {
    setLoading(true);
    setError(false);
    const { status, data } = await listOngoingTopics();
    if (status === 200 && data?.ok) {
      setTopics(data.topics);
    } else {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <PageShell width="prose">
      <PageHeader
        eyebrow="Marshmallow"
        title="进行中的棉花糖"
        lead="选择一个正在收集的主题，前往投递你的棉花糖。"
      />

      <div className="mt-8">
        {loading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <div className="h-32 animate-pulse rounded-xs bg-soft" />
            <div className="h-32 animate-pulse rounded-xs bg-soft" />
          </div>
        ) : error ? (
          <EmptyState
            title="加载失败"
            description="请稍后重试"
            action={
              <button
                type="button"
                onClick={load}
                className="min-h-11 rounded-md border border-line-strong px-4 text-small text-ink-dim transition-colors hover:text-ink"
              >
                重试
              </button>
            }
          />
        ) : topics.length === 0 ? (
          <EmptyState title="暂无进行中的棉花糖" description="新的主题开始后，会出现在这里。" />
        ) : (
          <div className="flex flex-col gap-3">
            {topics.map((t) => (
              <Link key={t.id} href={`/topics?id=${t.id}`} className="block">
                <Surface padding="sm" className="transition-colors duration-(--duration-fast) hover:border-line-strong">
                  <h2 className="truncate font-serif text-h3 font-semibold text-ink">{t.title}</h2>
                  <p className="mt-1 line-clamp-3 text-small text-ink-dim">
                    {toSingleLinePlainText(t.description)}
                  </p>
                  <p className="mt-2 font-mono text-label text-ink-dim">
                    {new Date(t.startAt).toLocaleDateString()} – {new Date(t.endAt).toLocaleDateString()}
                  </p>
                </Surface>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
