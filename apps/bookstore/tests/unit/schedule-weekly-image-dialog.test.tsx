// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/schedule/api", () => ({
  listPlans: vi.fn(async () => ({ status: 200, data: { plans: [] } })),
}));

import WeeklyImageDialog from "@/features/schedule/weeklyImage/WeeklyImageDialog";
import { clearMemoryCache } from "@/features/schedule/weeklyImage/storage";

const renderImage = vi.fn();

beforeEach(() => {
  renderImage.mockReset();
  renderImage.mockResolvedValue("data:image/png;base64,abc123");
  localStorage.clear();
  clearMemoryCache();
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

  it("显示默认方案标识", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("默认方案")).toBeTruthy());
  });

  it("显示设置面板", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("对齐")).toBeTruthy());
    expect(screen.getByText("字号")).toBeTruthy();
    expect(screen.getByText("颜色")).toBeTruthy();
  });

  it("显示按天设置面板", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("按天设置")).toBeTruthy());
    expect(screen.getByText("周一")).toBeTruthy();
    expect(screen.getByText("周日")).toBeTruthy();
  });

  it("切换对齐方式触发重绘", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
    renderImage.mockClear();
    
    fireEvent.click(screen.getByText("居中"));
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
  });

  it("编辑默认方案模式", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("默认方案")).toBeTruthy());
    
    fireEvent.click(screen.getByText("编辑默认方案"));
    expect(screen.getByText("编辑默认方案").closest("button")?.classList.contains("bg-flower")).toBeTruthy();
  });

  it("展开按天设置面板", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("周一")).toBeTruthy());
    
    fireEvent.click(screen.getByText("周一"));
    await waitFor(() => expect(screen.getByText("内容模板")).toBeTruthy());
  });
});