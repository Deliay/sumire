// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import PlanFormDialog from "@/features/schedule/PlanFormDialog";
import type { StreamPlan } from "@/features/schedule/api";
import type { TimeType } from "@/features/schedule/timeType";

const createSpy = vi.fn();
const updateSpy = vi.fn();

vi.mock("@/features/schedule/api", () => ({
  createPlan: (input: { date: string; timeType: TimeType; startTime: string | null; title: string }) => createSpy(input),
  updatePlan: (id: string, input: { date: string; timeType: TimeType; startTime: string | null; title: string }) => updateSpy(id, input),
}));

const plan: StreamPlan = { id: "p1", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈", createdAt: "" };

beforeEach(() => {
  createSpy.mockReset();
  updateSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("PlanFormDialog 录入态", () => {
  it("标题为「增加直播计划」，预填 preselectDate", () => {
    render(<PlanFormDialog open mode="create" preselectDate="2026-08-15" onClose={() => {}} onSaved={() => {}} />);
    expect(screen.getByText("增加直播计划")).toBeTruthy();
    expect((screen.getByLabelText("日期") as HTMLInputElement).value).toBe("2026 年 8 月 15 日");
  });

  it("三字段必填，未填全时提交禁用", async () => {
    render(<PlanFormDialog open mode="create" onClose={() => {}} onSaved={() => {}} />);
    const submit = screen.getByRole("button", { name: "确认" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it("保存成功后回调 onSaved 并关闭", async () => {
    createSpy.mockResolvedValueOnce({
      status: 201,
      data: { ok: true, id: "new", date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈" },
    });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<PlanFormDialog open mode="create" preselectDate="2026-08-15" onClose={onClose} onSaved={onSaved} />);
    fireEvent.focus(screen.getByLabelText("开始时间"));
    fireEvent.click(screen.getByText("20:00"));
    fireEvent.change(screen.getByLabelText("直播主题"), { target: { value: "杂谈" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await screen.findByRole("dialog");
    expect(createSpy).toHaveBeenCalledWith({ date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "杂谈" });
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe("PlanFormDialog 编辑态", () => {
  it("标题为「编辑直播计划」并预填现值，提交走 updatePlan", async () => {
    updateSpy.mockResolvedValueOnce({
      status: 200,
      data: { ok: true, id: "p1", date: "2026-08-16", timeType: "fixed", startTime: "21:00", title: "歌杂" },
    });
    const onSaved = vi.fn();
    render(<PlanFormDialog open mode="edit" initial={plan} onClose={() => {}} onSaved={onSaved} />);
    expect(screen.getByText("编辑直播计划")).toBeTruthy();
    expect((screen.getByLabelText("直播主题") as HTMLInputElement).value).toBe("杂谈");
    fireEvent.change(screen.getByLabelText("直播主题"), { target: { value: "歌杂" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await screen.findByRole("dialog");
    expect(updateSpy).toHaveBeenCalledWith("p1", { date: "2026-08-15", timeType: "fixed", startTime: "20:00", title: "歌杂" });
    expect(onSaved).toHaveBeenCalled();
  });
});
