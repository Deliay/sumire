// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SubmitDoneView from "@/features/topics/components/SubmitDoneView";

describe("SubmitDoneView", () => {
  it("展示成功提示与「查看进行中的棉花糖」链接，且无「再投一条」", () => {
    render(<SubmitDoneView />);
    expect(screen.getByText("提交成功，感谢你的棉花糖")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "查看进行中的棉花糖" });
    expect(link).toHaveAttribute("href", "/topics");
    expect(screen.queryByRole("button", { name: "再投一条" })).not.toBeInTheDocument();
    expect(screen.queryByText("再投一条")).not.toBeInTheDocument();
  });
});