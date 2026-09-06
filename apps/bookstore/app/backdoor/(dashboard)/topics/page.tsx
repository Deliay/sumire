"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TopicCard from "@/features/topics/components/TopicCard";
import TopicFormDialog from "@/features/topics/components/TopicFormDialog";
import { listTopics, createTopic, setCollecting, archiveTopic } from "@/features/topics/api";
import type { Topic } from "@/features/topics/types";

export default function TopicsPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await listTopics();
      if (!cancelled && data?.ok) setTopics(data.topics);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const reload = async () => {
    const { data } = await listTopics();
    if (data?.ok) setTopics(data.topics);
  };

  const handleCreate = async (data: Parameters<typeof createTopic>[0]) => {
    const { status, data: resp } = await createTopic(data);
    if (status === 201 && resp && "id" in resp) {
      await reload();
    } else {
      throw new Error(resp && "error" in resp ? resp.error : "创建失败");
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-medium text-ink">棉花糖</h1>
          <p className="text-sm text-ink-dim">提问箱主题管理</p>
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
        <div className="text-center text-ink-dim py-8">还没有主题，点击右上角新建</div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic) => (
            <TopicCard
              key={topic.id}
              id={topic.id}
              title={topic.title}
              status={topic.status}
              onStartStop={() => handleStartStop(topic.id, topic.status)}
              onArchive={() => handleArchive(topic.id)}
              onEdit={() => router.push(`/backdoor/topics/${topic.id}`)}
              onClick={() => router.push(`/backdoor/topics/${topic.id}`)}
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
    </div>
  );
}
