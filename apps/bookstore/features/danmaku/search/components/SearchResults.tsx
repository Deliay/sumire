"use client";

import type { LiveEvent } from "../../types";
import type { SearchStatus } from "../useDanmakuSearch";
import SearchResultCard from "./SearchResultCard";

interface SearchResultsProps {
  results: LiveEvent[];
  total: number;
  status: SearchStatus;
  loadingMore: boolean;
  error: string | null;
  keyword: string;
  onLoadMore: () => void;
  onRetry?: () => void;
}

export default function SearchResults({
  results,
  total,
  status,
  loadingMore,
  error,
  keyword,
  onLoadMore,
  onRetry,
}: SearchResultsProps) {
  if (status === "idle" && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-ink-dim">
        <p>输入关键词搜索弹幕内容</p>
      </div>
    );
  }

  if (status === "loading" && results.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-ink-dim">
        <p>搜索中…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-ink-dim">
        <p>{error ?? "请求失败"}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  if (results.length === 0 && status === "done") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-ink-dim">
        <p>无匹配弹幕</p>
      </div>
    );
  }

  const hasMore = results.length < total;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-ink-dim">共 {total} 条</p>
      <div className="flex flex-wrap gap-3">
        {results.map((event) => (
          <SearchResultCard key={event.eventId} event={event} keyword={keyword} />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center py-4">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors hover:border-flower hover:text-ink disabled:opacity-50"
          >
            {loadingMore ? "加载中…" : "加载更多"}
          </button>
        </div>
      )}
    </div>
  );
}
