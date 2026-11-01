// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("@/features/topics/api", () => ({
  listOngoingTopics: vi.fn(),
}));

import TopicsOngoingPage from "@/features/topics/components/TopicsOngoingPage";
import { listOngoingTopics } from "@/features/topics/api";

const mockList = vi.mocked(listOngoingTopics);

describe("TopicsOngoingPage（进行中的棉花糖列表）", () => {
  beforeEach(() => {
    mockList.mockReset();
  });

  it("有进行中主题时渲染卡片列表，整卡链接到收集页", async () => {
    mockList.mockResolvedValue({
      status: 200,
      data: {
        ok: true,
        topics: [
          {
            id: "t1",
            title: "主题A",
            description: "# 描述\n多行",
            startAt: new Date().toISOString(),
            endAt: new Date(Date.now() + 86400000).toISOString(),
            charLimit: 1000,
            status: "collecting",
          },
        ],
      },
    });
    render(<TopicsOngoingPage />);
    await waitFor(() => expect(screen.getByText("主题A")).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /主题A/ });
    expect(link).toHaveAttribute("href", "/topics?id=t1");
  });

  it("无进行中主题时展示空态", async () => {
    mockList.mockResolvedValue({ status: 200, data: { ok: true, topics: [] } });
    render(<TopicsOngoingPage />);
    await waitFor(() => expect(screen.getByText("暂无进行中的棉花糖")).toBeInTheDocument());
  });

  it("加载失败展示重试入口", async () => {
    mockList.mockResolvedValue({ status: 500, data: null });
    render(<TopicsOngoingPage />);
    await waitFor(() => expect(screen.getByText("加载失败，请稍后重试")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });
});