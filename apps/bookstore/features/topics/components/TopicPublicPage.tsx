"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import MarkdownView from "@/features/markdown/MarkdownView";
import MarkdownEditor from "@/features/markdown/MarkdownEditor";
import ConfirmDialog from "@/features/topics/components/ConfirmDialog";
import SubmitDoneView from "@/features/topics/components/SubmitDoneView";
import { getTopicPublic, submitMarshmallow } from "@/features/topics/api";
import { getStatusText, getStatusBadgeClass } from "@/features/topics/status";
import { getClientKey } from "@/features/topics/clientKey";
import type { TopicPublicInfo } from "@/features/topics/types";

type ViewState = "form" | "submitting" | "done";

export default function TopicPublicPage() {
  // B8: 从查询串 id 读取（静态导出不支持动态路由直达）
  const searchParams = useSearchParams();
  const topicId = searchParams.get("id") ?? "";
  const [topic, setTopic] = useState<TopicPublicInfo | null>(null);
  const [content, setContent] = useState("");
  const [viewState, setViewState] = useState<ViewState>("form");
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!topicId) return;
    let cancelled = false;
    (async () => {
      const { status, data } = await getTopicPublic(topicId);
      if (!cancelled) {
        if (status === 200 && data?.ok) {
          setTopic(data.topic);
        } else {
          setNotFound(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [topicId]);

  const handleSubmit = useCallback(async () => {
    if (!topicId || !content.trim()) {
      setError("内容不能为空");
      return;
    }
    if (topic && content.trim().length > topic.charLimit) {
      setError(`内容不能超过 ${topic.charLimit} 字`);
      return;
    }
    setViewState("submitting");
    setError("");
    try {
      const clientKey = getClientKey();
      const { status, data } = await submitMarshmallow(topicId, content.trim(), clientKey);
      if (status === 201 && data?.ok) {
        setViewState("done");
      } else if (status === 429) {
        setError("操作频率过快");
        setViewState("form");
      } else if (status === 409 || status === 410) {
        setError(data?.error ?? "无法投递");
        setViewState("form");
      } else if (status === 400) {
        setError(data?.error ?? "内容格式错误");
        setViewState("form");
      } else {
        setError("投递失败，请重试");
        setViewState("form");
      }
    } catch {
      setError("投递失败，请重试");
      setViewState("form");
    }
  }, [content, topic, topicId]);

  const handleAgain = () => {
    setContent("");
    setViewState("form");
  };

  if (notFound) {
    return (
      <div className="max-w-[40rem] mx-auto px-5 py-8 text-center text-ink-dim">
        <p className="text-lg mb-2">主题不存在</p>
        <p className="text-sm">请检查链接是否正确</p>
      </div>
    );
  }

  if (!topic) {
    return (
      <div className="max-w-[40rem] mx-auto px-5 py-8 text-center text-ink-dim">
        加载中…
      </div>
    );
  }

  const status = topic.status;
  const isCollecting = status === "collecting";

  return (
    <div className="max-w-[40rem] mx-auto px-5 py-8">
      {/* 主题信息 */}
      <h1 className="font-serif text-2xl font-semibold text-ink mb-2">{topic.title}</h1>
      <div className="flex items-center gap-2 mb-4 text-xs text-ink-dim">
        <span className={getStatusBadgeClass(status)}>{getStatusText(status)}</span>
        <span>
          {new Date(topic.startAt).toLocaleDateString()} –{" "}
          {new Date(topic.endAt).toLocaleDateString()}
        </span>
      </div>
      <div className="mb-6">
        <MarkdownView content={topic.description} />
      </div>

      {/* 投递区 */}
      {viewState === "done" ? (
        <SubmitDoneView onAgain={handleAgain} />
      ) : (
        <>
          {status === "upcoming" && (
            <div className="text-center text-ink-dim py-8">主题尚未开始，敬请期待</div>
          )}
          {status === "ended" && (
            <div className="text-center text-ink-dim py-8">主题已结束，感谢参与</div>
          )}
          {(isCollecting || status === "upcoming" || status === "ended") && (
            <>
              <div className="mb-2">
                <MarkdownEditor
                  value={content}
                  onChange={setContent}
                  readOnly={viewState === "submitting" || !isCollecting}
                  minHeight="12rem"
                />
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-ink-dim">
                  最多 {topic.charLimit} 字 · {content.trim().length}/{topic.charLimit}
                </span>
              </div>
              {error && (
                <div role="alert" className="mb-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={viewState === "submitting" || !isCollecting}
                className="w-full py-2.5 text-sm bg-primary text-night rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {viewState === "submitting" ? "投递中…" : "投递棉花糖"}
              </button>
            </>
          )}
        </>
      )}

      {showConfirm && (
        <ConfirmDialog
          onConfirm={() => {
            setShowConfirm(false);
            handleSubmit();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
