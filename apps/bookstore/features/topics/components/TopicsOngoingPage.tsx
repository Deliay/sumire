"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
    return () => { cancelled = true; };
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
    <div className="max-w-[40rem] mx-auto px-5 py-8">
      <h1 className="font-serif text-2xl font-semibold text-ink mb-2">进行中的棉花糖</h1>
      <p className="text-sm text-ink-dim mb-6">选择一个正在收集的主题，前往投递你的棉花糖</p>

      {loading ? (
        <div className="text-center text-ink-dim py-8">加载中…</div>
      ) : error ? (
        <div className="text-center py-8">
          <p className="text-sm text-ink-dim mb-3">加载失败，请稍后重试</p>
          <button
            type="button"
            onClick={load}
            className="px-4 py-1.5 text-sm border border-vine rounded text-ink-dim hover:text-ink"
          >
            重试
          </button>
        </div>
      ) : topics.length === 0 ? (
        <div className="text-center text-ink-dim py-8">暂无进行中的棉花糖</div>
      ) : (
        <div className="space-y-3">
          {topics.map((t) => (
            <Link
              key={t.id}
              href={`/topics?id=${t.id}`}
              className="block rounded-lg border border-vine bg-raised p-4 transition-colors duration-150 hover:border-primary"
            >
              <h3 className="font-medium text-ink truncate">{t.title}</h3>
              <p className="mt-1 line-clamp-3 text-sm text-ink-dim">
                {toSingleLinePlainText(t.description)}
              </p>
              <p className="mt-2 text-xs text-ink-dim">
                {new Date(t.startAt).toLocaleDateString()} –{" "}
                {new Date(t.endAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}