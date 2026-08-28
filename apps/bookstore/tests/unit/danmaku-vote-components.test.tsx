// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import ToolCard from "@/features/danmaku-tools/ToolCard";
import VoteOptionsEditor from "@/features/danmaku-tools/vote/components/VoteOptionsEditor";
import VoteControlBar from "@/features/danmaku-tools/vote/components/VoteControlBar";
import VoteStatsTable from "@/features/danmaku-tools/vote/components/VoteStatsTable";
import ClearVoteDialog from "@/features/danmaku-tools/vote/components/ClearVoteDialog";

afterEach(() => {
  cleanup();
});

describe("ToolCard", () => {
  it("渲染名称和简介", () => {
    render(<ToolCard name="弹幕投票" description="观众弹幕实时投票统计" href="/vote" />);
    expect(screen.getByText("弹幕投票")).toBeTruthy();
    expect(screen.getByText("观众弹幕实时投票统计")).toBeTruthy();
  });

  it("链接指向正确地址", () => {
    render(<ToolCard name="弹幕投票" description="观众弹幕实时投票统计" href="/vote" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/vote");
  });
});

describe("VoteOptionsEditor", () => {
  it("空值添加被拒且 hint 可见", () => {
    const onAdd = vi.fn();
    render(
      <VoteOptionsEditor
        options={[]}
        voting={false}
        onAdd={onAdd}
        onRemove={vi.fn()}
        hint="名称和关键字不能为空"
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("名称和关键字不能为空")).toBeTruthy();
  });

  it("冲突关键字拒绝且 hint 可见", () => {
    const onAdd = vi.fn();
    render(
      <VoteOptionsEditor
        options={[{ id: "1", name: "选项A", keyword: "唱歌", count: 0 }]}
        voting={false}
        onAdd={onAdd}
        onRemove={vi.fn()}
        hint="关键字与已有选项冲突"
      />,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("关键字与已有选项冲突")).toBeTruthy();
  });

  it("voting 时输入与按钮 disabled", () => {
    render(
      <VoteOptionsEditor
        options={[]}
        voting={true}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        hint={null}
      />,
    );
    expect(screen.getByPlaceholderText("名称").getAttribute("disabled")).toBe("");
    expect(screen.getByPlaceholderText("匹配关键字").getAttribute("disabled")).toBe("");
    expect(screen.getByText("添加选项").getAttribute("disabled")).toBe("");
  });

  it("删除按钮触发回调", () => {
    const onRemove = vi.fn();
    render(
      <VoteOptionsEditor
        options={[{ id: "1", name: "选项A", keyword: "唱歌", count: 0 }]}
        voting={false}
        onAdd={vi.fn()}
        onRemove={onRemove}
        hint={null}
      />,
    );
    fireEvent.click(screen.getByText("删除"));
    expect(onRemove).toHaveBeenCalledWith("1");
  });
});

describe("VoteControlBar", () => {
  it("开始投票文案", () => {
    render(
      <VoteControlBar
        voting={false}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("开始投票")).toBeTruthy();
  });

  it("停止投票文案", () => {
    render(
      <VoteControlBar
        voting={true}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("停止投票")).toBeTruthy();
  });

  it("两态类名不同且停止态含 bg-crimson", () => {
    const { rerender } = render(
      <VoteControlBar
        voting={false}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const startButton = screen.getByText("开始投票");
    expect(startButton.className).not.toContain("bg-crimson");

    rerender(
      <VoteControlBar
        voting={true}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const stopButton = screen.getByText("停止投票");
    expect(stopButton.className).toContain("bg-crimson");
  });

  it("清空按钮触发回调", () => {
    const onClear = vi.fn();
    render(
      <VoteControlBar
        voting={false}
        onStart={vi.fn()}
        onStop={vi.fn()}
        onClear={onClear}
      />,
    );
    fireEvent.click(screen.getByText("清空投票"));
    expect(onClear).toHaveBeenCalled();
  });
});

describe("VoteStatsTable", () => {
  it("计数文案正确", () => {
    render(
      <VoteStatsTable
        options={[{ id: "1", name: "选项A", keyword: "唱歌", count: 5 }]}
        processed={10}
        matched={5}
      />,
    );
    expect(screen.getByText("已处理 10 条弹幕，其中 5 条匹配")).toBeTruthy();
  });

  it("占比计算", () => {
    render(
      <VoteStatsTable
        options={[
          { id: "1", name: "选项A", keyword: "唱歌", count: 3 },
          { id: "2", name: "选项B", keyword: "游戏", count: 1 },
        ]}
        processed={10}
        matched={4}
      />,
    );
    expect(screen.getByText("75.0%")).toBeTruthy();
    expect(screen.getByText("25.0%")).toBeTruthy();
  });

  it("总票数 0 → 全部 0%", () => {
    render(
      <VoteStatsTable
        options={[
          { id: "1", name: "选项A", keyword: "唱歌", count: 0 },
          { id: "2", name: "选项B", keyword: "游戏", count: 0 },
        ]}
        processed={10}
        matched={0}
      />,
    );
    const percentages = screen.getAllByText("0%");
    expect(percentages.length).toBe(2);
  });
});

describe("ClearVoteDialog", () => {
  it("open 时渲染 dialog 与警示文案", () => {
    render(<ClearVoteDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("将清空当前所有投票数据（选项、统计与已投票记录），是否确认？")).toBeTruthy();
  });

  it("确认/取消回调分支", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ClearVoteDialog open onConfirm={onConfirm} onCancel={onCancel} />);
    
    // 点击确认清空按钮（不是标题）
    const confirmButton = screen.getByRole("button", { name: "确认清空" });
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalled();

    fireEvent.click(screen.getByText("取消"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("Esc 触发取消", () => {
    const onCancel = vi.fn();
    render(<ClearVoteDialog open onConfirm={vi.fn()} onCancel={onCancel} />);
    
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });

  it("遮罩点击触发取消", () => {
    const onCancel = vi.fn();
    render(<ClearVoteDialog open onConfirm={vi.fn()} onCancel={onCancel} />);
    
    // 点击遮罩（dialog 外部）
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onCancel).toHaveBeenCalled();
  });
});
