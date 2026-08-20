"use client";

import Link from "next/link";
import SearchBox from "@/features/danmaku/search/components/SearchBox";
import SearchResults from "@/features/danmaku/search/components/SearchResults";
import { useDanmakuSearch } from "@/features/danmaku/search/useDanmakuSearch";

export default function DanmakuSearchPage() {
  const { input, updateInput, flushSearch, results, total, status, loadingMore, error, loadMore } = useDanmakuSearch();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">弹幕检索</h1>
          <p className="mt-1 text-ink-dim">按关键词搜索历史弹幕内容</p>
        </div>
        <Link
          href="/backdoor/danmaku"
          className="rounded-md border border-vine/50 px-3 py-1.5 text-sm text-ink-dim transition-colors duration-150 hover:border-flower hover:text-ink"
        >
          返回看板
        </Link>
      </div>
      <SearchBox value={input} onChange={updateInput} onSearch={flushSearch} />
      <SearchResults
        results={results}
        total={total}
        status={status}
        loadingMore={loadingMore}
        error={error}
        keyword={input}
        onLoadMore={loadMore}
        onRetry={flushSearch}
      />
    </div>
  );
}
