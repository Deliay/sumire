"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import MarkdownView from "@/features/markdown/MarkdownView";
import CollapsibleMarkdown from "@/features/topics/components/CollapsibleMarkdown";
import { RequireRole } from "@/features/backdoor/RequireRole";
import { getTopic, listMarshmallows } from "@/features/topics/api";
import type { Topic, Marshmallow } from "@/features/topics/types";

const FONT_SIZE_KEY = "topics.presentation.fontSize";
const GUIDE_KEY = "topics.presentation.guideSeen";

function getInitialFontSize(): number {
  if (typeof window === "undefined") return 16;
  try {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    return stored ? Number(stored) || 16 : 16;
  } catch {
    return 16;
  }
}

function getInitialGuideSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !!localStorage.getItem(GUIDE_KEY);
  } catch {
    return false;
  }
}

// B8 同款方案：静态导出不支持动态路由直达，幻灯片页改用查询串 id（/backdoor/topics/presentation?id=xxx）
export default function PresentationView() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? "";
  const [topic, setTopic] = useState<Topic | null>(null);
  const [marshmallows, setMarshmallows] = useState<Marshmallow[]>([]);
  const [index, setIndex] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [showGuide, setShowGuide] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration from localStorage on mount
    setFontSize(getInitialFontSize());
    setShowGuide(!getInitialGuideSeen());
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { status, data: topicData } = await getTopic(id);
      if (!cancelled) {
        if (status === 200 && topicData?.ok) {
          setTopic(topicData.topic);
        } else {
          setNotFound(true);
        }
      }
      // 逐页拉取所有棉花糖（后端钳制 100）
      let allMarshmallows: Marshmallow[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && !cancelled) {
        const { data: marshData } = await listMarshmallows(id, { page, pageSize: 100 });
        if (!cancelled && marshData?.ok) {
          allMarshmallows = [...allMarshmallows, ...marshData.marshmallows];
          hasMore = allMarshmallows.length < marshData.total;
          page++;
        } else {
          hasMore = false;
        }
      }
      if (!cancelled) {
        setMarshmallows(allMarshmallows.filter((m) => m.adopted));
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleFontSize = (delta: number) => {
    const next = Math.min(32, Math.max(12, fontSize + delta));
    setFontSize(next);
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(next));
    } catch {
      // ignore
    }
  };

  const closeGuide = () => {
    setShowGuide(false);
    try {
      localStorage.setItem(GUIDE_KEY, "1");
    } catch {
      // ignore
    }
  };

  const current = marshmallows[index];

  return (
    <RequireRole role="admin">
      {notFound ? (
        <div className="h-screen flex items-center justify-center bg-night text-ink-dim">
          <div className="text-center">
            <p className="text-lg mb-2">主题不存在</p>
            <p className="text-sm">请检查链接是否正确</p>
          </div>
        </div>
      ) : !topic ? (
        <div className="h-screen flex items-center justify-center bg-night text-ink-dim">
          加载中…
        </div>
      ) : (
        <div className="h-screen flex flex-col bg-night text-ink">
          {/* 页头 */}
          <div className="shrink-0 p-4 text-center">
            <h1 className="text-xl font-medium">{topic.title}</h1>
            <div className="mt-1">
              <CollapsibleMarkdown content={topic.description} />
            </div>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleFontSize(-2)}
                className="text-sm text-ink-dim hover:text-ink"
              >
                A−
              </button>
              <button
                type="button"
                onClick={() => handleFontSize(2)}
                className="text-sm text-ink-dim hover:text-ink"
              >
                A+
              </button>
            </div>
          </div>

          {/* 放映区 */}
          <div className="flex-1 min-h-0 flex items-stretch">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="w-12 shrink-0 flex items-center justify-center text-ink-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="上一条"
            >
              ‹
            </button>

            <div className="flex-1 flex items-center justify-center px-4">
              {marshmallows.length === 0 ? (
                <div className="text-ink-dim text-center">
                  还没有已采用的棉花糖，请先在详情页采用
                </div>
              ) : current ? (
                <div
                  className="max-w-[50%] h-full overflow-y-auto p-4"
                  style={{ fontSize }}
                >
                  <MarkdownView content={current.content} />
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(marshmallows.length - 1, i + 1))}
              disabled={index >= marshmallows.length - 1}
              className="w-12 shrink-0 flex items-center justify-center text-ink-dim hover:text-ink disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="下一条"
            >
              ›
            </button>
          </div>

          {/* 首次引导遮盖层 */}
          {showGuide && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/85">
              <div className="bg-raised border border-vine rounded-lg p-6 max-w-sm text-center">
                <p className="text-sm text-ink mb-2">左右翻页按钮切换条目</p>
                <p className="text-sm text-ink mb-2">条目内容可在内部滚动</p>
                <p className="text-sm text-ink mb-4">A−/A+ 调节字号</p>
                <button
                  type="button"
                  onClick={closeGuide}
                  className="px-4 py-1.5 text-sm bg-primary text-night rounded hover:bg-primary/90"
                >
                  知道了
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </RequireRole>
  );
}