// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/schedule/api", () => ({
  listPlans: vi.fn(async () => ({ status: 200, data: { plans: [] } })),
}));

import WeeklyImageDialog from "@/features/schedule/weeklyImage/WeeklyImageDialog";

const renderImage = vi.fn();

beforeEach(() => {
  renderImage.mockReset();
  renderImage.mockResolvedValue("data:image/png;base64,abc123");
});

afterEach(() => {
  cleanup();
});

describe("WeeklyImageDialog", () => {
  it("显示周标签与保存提示，渲染出预览 <img>", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/\d{4} 年第 \d+ 周/)).toBeTruthy();
    expect(screen.getByText("长按保存图片，或右键另存为")).toBeTruthy();
    await waitFor(() => expect(screen.getByAltText("周表图片")).toBeTruthy());
    expect(screen.getByAltText("周表图片").getAttribute("src")).toContain("data:image/png");
  });

  it("左右切换周标签变化", () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    const before = screen.getByText(/\d{4} 年第 \d+ 周/).textContent;
    fireEvent.click(screen.getByLabelText("下一周"));
    const after = screen.getByText(/\d{4} 年第 \d+ 周/).textContent;
    expect(after).not.toBe(before);
  });

  it("关闭时不渲染", () => {
    render(
      <WeeklyImageDialog open={false} onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("渲染失败显示错误与重试", async () => {
    renderImage.mockRejectedValue(new Error("素材加载失败"));
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("周表素材加载失败，请重试")).toBeTruthy());
    renderImage.mockResolvedValue("data:image/png;base64,ok");
    fireEvent.click(screen.getByText("重试"));
    await waitFor(() => expect(screen.getByAltText("周表图片")).toBeTruthy());
  });
});
