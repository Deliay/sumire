"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TopicCard from "@/features/topics/components/TopicCard";
import TopicFormDialog from "@/features/topics/components/TopicFormDialog";
import { RequireRole } from "@/features/backdoor/RequireRole";
import { listTopics, createTopic, updateTopic, setCollecting, archiveTopic, restoreTopic } from "@/features/topics/api";
import type { Topic } from "@/features/topics/types";

type ViewMode = "active" | "archived";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [view, setView] = useState<ViewMode>("active");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // I18: 编辑状态
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await listTopics({ archived: view === "archived" });
      if (!cancelled && data?.ok) {
        // round 9：已归档视图前端再按 archived === true 过滤（列表接口含归档时全量返回）
        setTopics(view === "archived" ? data.topics.filter((t) => t.archived) : data.topics);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [view]);

  const reload = async () => {
    const { data } = await listTopics({ archived: view === "archived" });
    if (data?.ok) {
      setTopics(view === "archived" ? data.topics.filter((t) => t.archived) : data.topics);
    }
  };

  const handleCreate = async (data: Parameters<typeof createTopic>[0]) => {
    const { status, data: resp } = await createTopic(data);
    if (status === 201 && resp && "id" in resp) {
      await reload();
    } else {
      throw new Error(resp && "error" in resp ? resp.error : "创建失败");
    }
  };

  const handleUpdate = async (data: Parameters<typeof updateTopic>[1]) => {
    if (!editingTopic) return;
    const { status } = await updateTopic(editingTopic.id, data);
    if (status === 200) {
      await reload();
      setEditingTopic(null);
    } else {
      throw new Error("更新失败");
    }
  };

  const handleStartStop = async (id: string, currentStatus: string) => {
    const action = currentStatus === "collecting" ? "stop" : "start";
    await setCollecting(id, action);
    await reload();
  };

  const handleArchive = async (id: string) => {
    if (!confirm("确定要归档这个主题吗？")) return;
    await archiveTopic(id);
    await reload();
  };

  const handleRestore = async (id: string) => {
    if (!confirm("确定要恢复这个主题吗？")) return;
    await restoreTopic(id);
    await reload();
  };

  return (
    <RequireRole role="admin">
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="font-serif text-2xl font-semibold text-ink">棉花糖</h1>
          {/* round 9：主题 / 已归档主题 视图切换 */}
          <div className="flex items-center gap-1 border border-vine rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setView("active")}
              aria-pressed={view === "active"}
              className={`px-3 py-1 text-sm ${
                view === "active" ? "bg-primary/20 text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              主题
            </button>
            <button
              type="button"
              onClick={() => setView("archived")}
              aria-pressed={view === "archived"}
              className={`px-3 py-1 text-sm ${
                view === "archived" ? "bg-primary/20 text-ink" : "text-ink-dim hover:text-ink"
              }`}
            >
              已归档主题
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm bg-primary text-night rounded hover:bg-primary/90"
        >
          新建主题
        </button>
      </div>

      {loading ? (
        <div className="text-center text-ink-dim py-8">加载中…</div>
      ) : topics.length === 0 ? (
        <div className="text-center text-ink-dim py-8">
          {view === "archived" ? "没有已归档的主题" : "还没有主题，点击右上角新建"}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              id={topic.id}
              title={topic.title}
              status={topic.status}
              archived={view === "archived"}
              onRestore={view === "archived" ? () => handleRestore(topic.id) : undefined}
              onStartStop={view === "archived" ? undefined : () => handleStartStop(topic.id, topic.status)}
              onArchive={view === "archived" ? undefined : () => handleArchive(topic.id)}
              // I18: 修改按钮打开表单而非跳转详情
              onEdit={view === "archived" ? undefined : () => setEditingTopic(topic)}
              onClick={() => router.push(`/backdoor/topics/detail?id=${topic.id}`)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <TopicFormDialog
          mode="create"
          onSubmit={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* I18: 编辑表单 */}
      {editingTopic && (
        <TopicFormDialog
          mode="edit"
          initial={{
            title: editingTopic.title,
            description: editingTopic.description,
            startAt: new Date(editingTopic.startAt).toLocaleString("sv-SE").slice(0, 16),
            endAt: new Date(editingTopic.endAt).toLocaleString("sv-SE").slice(0, 16),
            charLimit: editingTopic.charLimit,
            aiReviewEnabled: editingTopic.aiReviewEnabled,
          }}
          onSubmit={handleUpdate}
          onClose={() => setEditingTopic(null)}
        />
      )}
    </div>
    </RequireRole>
  );
}
