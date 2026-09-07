// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Topic } from "@/features/topics/types";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
vi.mock("@/features/backdoor/RequireRole", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/topics/api", () => ({
  listTopics: vi.fn(),
  createTopic: vi.fn(),
  updateTopic: vi.fn(),
  setCollecting: vi.fn(),
  archiveTopic: vi.fn(),
  restoreTopic: vi.fn(),
}));

import TopicsPage from "@/app/backdoor/(dashboard)/topics/page";
import { listTopics, restoreTopic } from "@/features/topics/api";

const mockList = vi.mocked(listTopics);
const mockRestore = vi.mocked(restoreTopic);

const ALL: Topic[] = [
  {
    id: "a",
    title: "进行中主题",
    description: "d",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 86400000).toISOString(),
    charLimit: 1000,
    aiReviewEnabled: false,
    status: "collecting",
    collectingStopped: false,
    archived: false,
    createdAt: new Date().toISOString(),
  } as Topic,
  {
    id: "b",
    title: "归档A",
    description: "d",
    startAt: new Date().toISOString(),
    endAt: new Date(Date.now() + 86400000).toISOString(),
    charLimit: 1000,
    aiReviewEnabled: false,
    status: "ended",
    collectingStopped: false,
    archived: true,
    createdAt: new Date().toISOString(),
  } as Topic,
];

describe("TopicsPage 已归档视图切换与恢复", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    mockList.mockImplementation(async ({ archived } = {}) => ({
      status: 200,
      data: {
        ok: true,
        topics: archived ? ALL : ALL.filter((t) => !t.archived),
      },
    }));
    mockRestore.mockResolvedValue({ status: 200, data: { ok: true } });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("切换已归档视图调用 listTopics({archived:true}) 且按 archived 过滤", async () => {
    render(<TopicsPage />);
    // 默认「主题」视图仅非归档
    await waitFor(() => expect(screen.getByText("进行中主题")).toBeInTheDocument());
    expect(screen.queryByText("归档A")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "已归档主题" }));
    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith({ archived: true }));
    await waitFor(() => expect(screen.getByText("归档A")).toBeInTheDocument());
    expect(screen.queryByText("进行中主题")).not.toBeInTheDocument();
    // 已归档卡片仅「恢复」
    expect(screen.getByRole("button", { name: "恢复" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "归档" })).not.toBeInTheDocument();
  });

  it("已归档视图空态文案「没有已归档的主题」", async () => {
    mockList.mockResolvedValue({ status: 200, data: { ok: true, topics: [] } });
    render(<TopicsPage />);
    fireEvent.click(screen.getByRole("button", { name: "已归档主题" }));
    await waitFor(() => expect(screen.getByText("没有已归档的主题")).toBeInTheDocument());
  });

  it("点击已归档卡片「恢复」回调 restoreTopic 并重新加载", async () => {
    render(<TopicsPage />);
    fireEvent.click(screen.getByRole("button", { name: "已归档主题" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "恢复" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "恢复" }));
    await waitFor(() => expect(mockRestore).toHaveBeenCalledWith("b"));
    // confirm 接受后 reload → listTopics 再次被调用
    await waitFor(() => expect(mockList.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});