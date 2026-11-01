// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("id=t1"),
}));
vi.mock("@/features/backdoor/RequireRole", () => ({
  RequireRole: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/features/topics/api", () => ({
  getTopic: vi.fn(),
  listMarshmallows: vi.fn(),
}));

import PresentationView from "@/features/topics/components/PresentationView";
import { getTopic, listMarshmallows } from "@/features/topics/api";
import type { Marshmallow, Topic } from "@/features/topics/types";

const mockGet = vi.mocked(getTopic);
const mockList = vi.mocked(listMarshmallows);

const TOPIC = {
  id: "t1",
  title: "放映主题",
  description: "描述",
  startAt: new Date().toISOString(),
  endAt: new Date(Date.now() + 86400000).toISOString(),
  charLimit: 1000,
  aiReviewEnabled: true,
  status: "collecting",
  collectingStopped: false,
  archived: false,
  createdAt: new Date().toISOString(),
} as Topic;

function marshmallow(id: string, content: string): Marshmallow {
  return {
    id,
    topicId: "t1",
    content,
    adopted: true,
    aiReview: null,
    createdAt: new Date().toISOString(),
  } as Marshmallow;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PresentationView 切换条目", () => {
  it("切到下一条时内容区回到顶部", async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: { ok: true, topic: TOPIC },
    } as Awaited<ReturnType<typeof getTopic>>);
    mockList.mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        marshmallows: [
          marshmallow("m1", "第一条内容"),
          marshmallow("m2", "第二条内容"),
        ],
        total: 2,
      },
    } as Awaited<ReturnType<typeof listMarshmallows>>);

    render(<PresentationView />);

    const first = await screen.findByText("第一条内容");
    // 内容区为 prose 的直接父级（overflow-y-auto 滚动容器）
    const scroller = first.closest(".overflow-y-auto") as HTMLElement;
    expect(scroller).not.toBeNull();

    scroller.scrollTop = 300;
    expect(scroller.scrollTop).toBe(300);

    fireEvent.click(screen.getByRole("button", { name: "下一条" }));

    await screen.findByText("第二条内容");
    await waitFor(() => expect(scroller.scrollTop).toBe(0));
  });
});
