// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=t1"),
}));
vi.mock("@/features/backdoor/RequireRole", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/topics/api", () => ({
  getTopic: vi.fn(),
  listMarshmallows: vi.fn(),
  updateTopic: vi.fn(),
  setCollecting: vi.fn(),
  archiveTopic: vi.fn(),
  updateMarshmallow: vi.fn(),
}));

import TopicDetailView from "@/features/topics/components/TopicDetailView";
import { getTopic, listMarshmallows } from "@/features/topics/api";
import type { Marshmallow, Topic } from "@/features/topics/types";

const mockGet = vi.mocked(getTopic);
const mockList = vi.mocked(listMarshmallows);

const ARCHIVED_TOPIC = {
  id: "t1",
  title: "已归档主题",
  description: "描述",
  startAt: new Date().toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
  charLimit: 1000,
  aiReviewEnabled: true,
  status: "ended",
  collectingStopped: false,
  archived: true,
  createdAt: new Date().toISOString(),
} as Topic;

const REJECTED_MARSH = {
  id: "m1",
  topicId: "t1",
  content: "# 内容",
  adopted: false,
  aiReview: { status: "rejected", filteredReason: "原因", ignoredByAdmin: false },
  createdAt: new Date().toISOString(),
} as Marshmallow;

describe("TopicDetailView 已归档只读", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("工具栏仅「分享」「幻灯片」，无修改主题/开始结束收集/归档", async () => {
    mockGet.mockResolvedValue({ status: 200, data: { ok: true, topic: ARCHIVED_TOPIC } });
    mockList.mockResolvedValue({ status: 200, data: { ok: true, marshmallows: [], total: 0 } });
    render(<TopicDetailView />);
    await waitFor(() => expect(screen.getByRole("button", { name: "分享" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "幻灯片" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "修改主题" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /开始收集|结束收集/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();
  });

  it("已归档主题的棉花糖卡片不渲染采用/取消采用，rejected 覆盖层不渲染「显示这条棉花糖」", async () => {
    mockGet.mockResolvedValue({ status: 200, data: { ok: true, topic: ARCHIVED_TOPIC } });
    mockList.mockResolvedValue({
      status: 200,
      data: { ok: true, marshmallows: [REJECTED_MARSH], total: 1 },
    });
    render(<TopicDetailView />);
    // 内容渲染（rejected 覆盖层提示原因）
    await waitFor(() => expect(screen.getByText(/AI拒绝原因/)).toBeInTheDocument());
    // 无采用/取消采用、无「显示这条棉花糖」写操作入口
    expect(screen.queryByRole("button", { name: "采用" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "取消采用" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "显示这条棉花糖" })).not.toBeInTheDocument();
  });
});