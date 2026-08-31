// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/features/schedule/api", () => ({
  listPlans: vi.fn(async () => ({ status: 200, data: { plans: [] } })),
}));

import WeeklyImageDialog from "@/features/schedule/weeklyImage/WeeklyImageDialog";
import { clearMemoryCache, loadDefault, loadWeek, saveDefault } from "@/features/schedule/weeklyImage/storage";
import { createDefaultScheme, type DefaultScheme } from "@/features/schedule/weeklyImage/scheme";
import { getISOWeek } from "@/features/schedule/weeklyImage/weekUtils";

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
    await waitFor(() => expect(screen.getAllByText("对齐").length).toBeGreaterThan(0));
    expect(screen.getAllByText("字号").length).toBeGreaterThan(0);
    expect(screen.getAllByText("颜色").length).toBeGreaterThan(0);
  });

  it("显示按天设置面板", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("按天设置")).toBeTruthy());
    expect(screen.getByText("周一")).toBeTruthy();
    expect(screen.getByText("周日")).toBeTruthy();
  });

  it("显示日期设置面板", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("日期设置")).toBeTruthy());
    expect(screen.getByLabelText("启用日期范围")).toBeTruthy();
    expect(screen.getByText("日期格式")).toBeTruthy();
    expect(screen.getByText("日期内容")).toBeTruthy();
  });

  it("默认不勾选启用日期范围", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByLabelText("启用日期范围")).not.toBeChecked());
  });

  it("勾选启用日期范围后日期指令产出", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
    renderImage.mockClear();
    
    // 勾选启用日期范围
    fireEvent.click(screen.getByLabelText("启用日期范围"));
    
    // 验证重绘被触发
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
  });

  it("日期设置变更触发重绘", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
    renderImage.mockClear();
    
    const formatInput = screen.getByLabelText("日期格式");
    fireEvent.change(formatInput, { target: { value: "{yy}/{mm}/{dd}" } });
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
  });

  it("日期设置随方案回显", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByLabelText("日期格式")).toHaveValue("{yyyy}年{mm}月{dd}日"));
    expect(screen.getByLabelText("日期内容")).toHaveValue("{开始日期} ~ {结束日期}");
  });

  it("编辑默认方案模式下改日期调用 saveDefault", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("默认方案")).toBeTruthy());
    
    // 进入编辑默认方案模式
    fireEvent.click(screen.getByText("编辑默认方案"));
    
    // 修改日期格式
    const formatInput = screen.getByLabelText("日期格式");
    fireEvent.change(formatInput, { target: { value: "{yy}/{mm}/{dd}" } });
    
    // 验证 saveDefault 被调用
    const saved = loadDefault();
    expect(saved.date?.format).toBe("{yy}/{mm}/{dd}");
  });

  it("非编辑默认方案模式下改日期调用 saveWeek", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("默认方案")).toBeTruthy());
    
    // 修改日期格式（不进入编辑默认方案模式）
    const formatInput = screen.getByLabelText("日期格式");
    fireEvent.change(formatInput, { target: { value: "{yy}/{mm}/{dd}" } });
    
    // 验证周方案被保存
    const wk = getISOWeek(new Date());
    const saved = loadWeek(wk);
    expect(saved).not.toBeNull();
    expect(saved?.date?.format).toBe("{yy}/{mm}/{dd}");
  });

  it("旧版本 scheme（无 date 字段）打开弹层不崩溃", async () => {
    // 保存一个没有 date 字段的旧版本方案
    const oldScheme = createDefaultScheme();
    delete (oldScheme as DefaultScheme & { date?: unknown }).date;
    saveDefault(oldScheme);
    
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByLabelText("日期格式")).toHaveValue("{yyyy}年{mm}月{dd}日"));
  });

  it("日期设置对齐按钮选中态正确", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("日期设置")).toBeTruthy());
    
    // 找到日期设置区块中的对齐按钮（第二个「对齐」标签后的按钮）
    const alignLabels = screen.getAllByText("对齐");
    const dateAlignSection = alignLabels[1].closest("div");
    const alignButtons = dateAlignSection?.querySelectorAll("button");
    
    expect(alignButtons).toBeDefined();
    expect(alignButtons?.length).toBe(4);
    
    // 默认状态下，「沿用」按钮应高亮（scheme.date?.align === undefined）
    const defaultButton = alignButtons![0]; // 「沿用」
    expect(defaultButton.classList.contains("bg-flower")).toBeTruthy();
    expect(defaultButton.classList.contains("text-white")).toBeTruthy();
    
    // 其他按钮不应高亮
    expect(alignButtons![1].classList.contains("bg-flower")).toBeFalsy(); // 「左」
    expect(alignButtons![2].classList.contains("bg-flower")).toBeFalsy(); // 「居中」
    expect(alignButtons![3].classList.contains("bg-flower")).toBeFalsy(); // 「右」
    
    // 点击「居中」按钮
    fireEvent.click(alignButtons![2]);
    
    // 现在「居中」按钮应高亮
    await waitFor(() => {
      expect(alignButtons![0].classList.contains("bg-flower")).toBeFalsy(); // 「沿用」不再高亮
      expect(alignButtons![2].classList.contains("bg-flower")).toBeTruthy(); // 「居中」高亮
    });
    
    // 点击「沿用」按钮
    fireEvent.click(alignButtons![0]);
    
    // 现在「沿用」按钮应重新高亮
    await waitFor(() => {
      expect(alignButtons![0].classList.contains("bg-flower")).toBeTruthy(); // 「沿用」高亮
      expect(alignButtons![2].classList.contains("bg-flower")).toBeFalsy(); // 「居中」不再高亮
    });
  });

  it("切换对齐方式触发重绘", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(renderImage).toHaveBeenCalled());
    renderImage.mockClear();
    
    // 点击全局设置中的「居中」按钮（不是日期设置中的）
    const centerButtons = screen.getAllByText("居中");
    // 全局设置中的居中按钮在日期设置之前
    fireEvent.click(centerButtons[0]);
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

  it("插入 {schedules} 变量后重开回显", async () => {
    const { unmount } = render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("周一")).toBeTruthy());
    
    // 展开周一设置
    fireEvent.click(screen.getByText("周一"));
    await waitFor(() => expect(screen.getByText("内容模板")).toBeTruthy());
    
    // 点击插入 {schedules} 按钮
    fireEvent.click(screen.getByText("插入 {schedules}"));
    
    // 关闭弹层
    unmount();
    
    // 重新打开弹层
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("周一")).toBeTruthy());
    
    // 展开周一设置，验证 {schedules} 变量已保存
    fireEvent.click(screen.getByText("周一"));
    await waitFor(() => {
      const textarea = screen.getByPlaceholderText("输入内容模板，使用 {schedules} 插入计划");
      expect(textarea).toHaveValue("{schedules}");
    });
  });

  it("周方案场景「恢复为默认方案」删除本周方案回退默认", async () => {
    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("周一")).toBeTruthy());

    // 通过编辑制造周方案（触发 ensureWeekScheme + saveWeek）
    fireEvent.click(screen.getByText("周一"));
    await waitFor(() => expect(screen.getByText("内容模板")).toBeTruthy());
    const textarea = screen.getByPlaceholderText("输入内容模板，使用 {schedules} 插入计划");
    fireEvent.change(textarea, { target: { value: "自定义" } });

    // 此时应处于周方案模式，出现「恢复为默认方案」
    const resetBtn = screen.getByText("恢复为默认方案");
    fireEvent.click(resetBtn);

    const wk = getISOWeek(new Date());
    expect(loadWeek(wk)).toBeNull();
  });

  it("编辑默认方案场景「恢复预设方案」重置默认方案为预设", async () => {
    const custom = createDefaultScheme();
    custom.global = { ...custom.global, color: "#123456", align: "center" };
    saveDefault(custom);
    expect(loadDefault().global.color).toBe("#123456");

    render(
      <WeeklyImageDialog open onClose={() => {}} renderImage={renderImage} baseImageUrl="/x.jpg" />,
    );
    await waitFor(() => expect(screen.getByText("周一")).toBeTruthy());

    // 进入编辑默认方案模式
    fireEvent.click(screen.getByText("编辑默认方案"));
    fireEvent.click(screen.getByText("恢复预设方案"));

    // 默认方案被重置为预设值
    expect(loadDefault().global.color).toBe("#5b4b68");
    expect(loadDefault().global.align).toBe("left");
  });
});