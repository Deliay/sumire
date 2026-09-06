"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import CollapsibleMarkdown from "@/features/topics/components/CollapsibleMarkdown";
import MarshmallowCard from "@/features/topics/components/MarshmallowCard";
import TopicFormDialog from "@/features/topics/components/TopicFormDialog";
import { RequireRole } from "@/features/backdoor/RequireRole";
import {
  getTopic,
  listMarshmallows,
  updateTopic,
  setCollecting,
  archiveTopic,
  updateMarshmallow,
} from "@/features/topics/api";
import { getStatusText, getStatusBadgeClass } from "@/features/topics/status";
import type { Topic, Marshmallow } from "@/features/topics/types";

export default function TopicDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [topic, setTopic] = useState<Topic | null>(null);
  const [marshmallows, setMarshmallows] = useState<Marshmallow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);

  // I17: 区分加载中与不存在
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status, data } = await getTopic(id);
      if (!cancelled) {
        if (status === 200 && data?.ok) {
          setTopic(data.topic);
        } else {
          setNotFound(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await listMarshmallows(id, { page });
      if (!cancelled && data?.ok) {
        setMarshmallows(data.marshmallows);
        setTotal(data.total);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, page]);

  const reload = async () => {
    const { data: topicData } = await getTopic(id);
    if (topicData?.ok) setTopic(topicData.topic);
    const { data: marshData } = await listMarshmallows(id, { page });
    if (marshData?.ok) {
      setMarshmallows(marshData.marshmallows);
      setTotal(marshData.total);
    }
  };

  const handleUpdate = async (data: {
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    charLimit: number;
    aiReviewEnabled?: boolean;
  }) => {
    const { status } = await updateTopic(id, data);
    if (status === 200) {
      await reload();
    } else {
      throw new Error("更新失败");
    }
  };

  const handleStartStop = async () => {
    if (!topic) return;
    const action = topic.status === "collecting" ? "stop" : "start";
    await setCollecting(id, action);
    await reload();
  };

  const handleArchive = async () => {
    if (!confirm("确定要归档这个主题吗？")) return;
    await archiveTopic(id);
    await reload();
  };

  const handleToggleAdopt = async (marshId: string, adopted: boolean) => {
    await updateMarshmallow(marshId, { adopted });
    await reload();
  };

  const handleShowAnyway = async (marshId: string) => {
    await updateMarshmallow(marshId, { ignoreAiFilter: true });
    await reload();
  };

  if (notFound) {
    return (
      <RequireRole role="admin">
        <div className="text-center text-ink-dim py-8">
          <p className="text-lg mb-2">主题不存在</p>
          <p className="text-sm">请检查链接是否正确</p>
        </div>
      </RequireRole>
    );
  }

  if (!topic) {
    return <div className="text-center text-ink-dim py-8">加载中…</div>;
  }

  return (
    <RequireRole role="admin">
    <div className="flex flex-col h-full">
      {/* 页头 */}
      <div className="shrink-0 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-medium text-ink">{topic.title}</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => window.open(`/backdoor/topics/${id}/presentation`, "_blank")}
              className="text-xs text-ink-dim hover:text-ink border border-vine rounded px-2 py-1"
            >
              幻灯片
            </button>
            <button
              type="button"
              onClick={handleStartStop}
              className="text-xs text-ink-dim hover:text-ink border border-vine rounded px-2 py-1"
            >
              {topic.status === "collecting" ? "结束收集" : "开始收集"}
            </button>
            <button
              type="button"
              onClick={handleArchive}
              className="text-xs text-ink-dim hover:text-ink border border-vine rounded px-2 py-1"
            >
              归档
            </button>
            <button
              type="button"
              onClick={() => setShowEdit(true)}
              className="text-xs text-ink-dim hover:text-ink border border-vine rounded px-2 py-1"
            >
              修改主题
            </button>
          </div>
        </div>
        <CollapsibleMarkdown content={topic.description} />
        <div className="flex items-center gap-2 mt-2 text-xs text-ink-dim">
          <span className={getStatusBadgeClass(topic.status)}>
            {getStatusText(topic.status)}
          </span>
          <span>
            {new Date(topic.startAt).toLocaleDateString()} –{" "}
            {new Date(topic.endAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* 棉花糖列表 */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
        {loading ? (
          <div className="text-center text-ink-dim py-8">加载中…</div>
        ) : marshmallows.length === 0 ? (
          <div className="text-center text-ink-dim py-8">还没有收到棉花糖</div>
        ) : (
          marshmallows.map((marsh) => (
            <MarshmallowCard
              key={marsh.id}
              marshmallow={marsh}
              onToggleAdopt={handleToggleAdopt}
              onShowAnyway={handleShowAnyway}
            />
          ))
        )}
      </div>

      {/* 分页 */}
      {total > 20 && (
        <div className="shrink-0 flex justify-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-ink-dim hover:text-ink disabled:opacity-50"
          >
            上一页
          </button>
          <span className="text-xs text-ink-dim">
            第 {page} 页 / 共 {Math.ceil(total / 20)} 页
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * 20 >= total}
            className="text-xs text-ink-dim hover:text-ink disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}

      {showEdit && (
        <TopicFormDialog
          mode="edit"
          initial={{
            title: topic.title,
            description: topic.description,
            // I16: 使用本地时区格式化 datetime-local
            startAt: new Date(topic.startAt).toLocaleString("sv-SE").slice(0, 16),
            endAt: new Date(topic.endAt).toLocaleString("sv-SE").slice(0, 16),
            charLimit: topic.charLimit,
            aiReviewEnabled: topic.aiReviewEnabled,
          }}
          onSubmit={handleUpdate}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
    </RequireRole>
  );
}
