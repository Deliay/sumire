import { request, API_CONFIGURED } from "@/features/backdoor/api";
import type { Topic, Marshmallow } from "./types";

// ===== 管理端点 =====

export async function listTopics(options?: { archived?: boolean }) {
  const params = options?.archived ? "?archived=true" : "";
  return request<{ ok: boolean; topics: Topic[] }>(`/api/topics${params}`);
}

export async function createTopic(input: {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  charLimit: number;
  aiReviewEnabled?: boolean;
}) {
  return request<{ ok: boolean; id: string } | { error: string }>("/api/topics", {
    method: "POST",
    body: input,
  });
}

export async function getTopic(id: string) {
  return request<{ ok: boolean; topic: Topic }>(`/api/topics/${id}`);
}

export async function updateTopic(
  id: string,
  input: {
    title: string;
    description: string;
    startAt: string;
    endAt: string;
    charLimit: number;
    aiReviewEnabled?: boolean;
  },
) {
  return request<{ ok: boolean }>(`/api/topics/${id}`, {
    method: "PUT",
    body: input,
  });
}

export async function setCollecting(id: string, action: "start" | "stop") {
  return request<{ ok: boolean } | { error: string }>(
    `/api/topics/${id}/collecting`,
    { method: "POST", body: { action } },
  );
}

export async function archiveTopic(id: string) {
  return request<{ ok: boolean } | { error: string }>(
    `/api/topics/${id}/archive`,
    { method: "POST" },
  );
}

export async function listMarshmallows(
  topicId: string,
  options?: { page?: number; pageSize?: number },
) {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("pageSize", String(options.pageSize));
  const qs = params.toString() ? `?${params}` : "";
  return request<{
    ok: boolean;
    marshmallows: Marshmallow[];
    total: number;
  }>(`/api/topics/${topicId}/marshmallows${qs}`);
}

export async function updateMarshmallow(
  id: string,
  data: { adopted?: boolean; ignoreAiFilter?: boolean },
) {
  return request<{ ok: boolean } | { error: string }>(
    `/api/marshmallows/${id}`,
    { method: "PATCH", body: data },
  );
}

// ===== 公开端点 =====

export async function getTopicPublic(id: string) {
  if (!API_CONFIGURED) return { status: 0, data: null };
  const res = await fetch(`/api/topics/${id}/public`, {
    credentials: "include",
  });
  const data = await res.json();
  return { status: res.status, data };
}

export async function submitMarshmallow(
  topicId: string,
  content: string,
  clientKey: string,
) {
  if (!API_CONFIGURED) return { status: 0, data: null };
  const res = await fetch(`/api/topics/${topicId}/marshmallows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, clientKey }),
    credentials: "include",
  });
  const data = await res.json();
  return { status: res.status, data };
}
