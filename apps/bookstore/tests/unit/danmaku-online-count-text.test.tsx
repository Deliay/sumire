// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnlineCountText } from "@/features/danmaku/components/OnlineCountText";

describe("OnlineCountText", () => {
  it("onlineCount=null 不渲染任何内容", () => {
    const { container } = render(<OnlineCountText onlineCount={null} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText(/考子在线/)).toBeNull();
  });

  it("onlineCount=1521 渲染文本「当前直播间在线 1521 人」", () => {
    render(<OnlineCountText onlineCount={1521} />);
    expect(screen.getByText("当前有 1521 考子在线")).toBeTruthy();
  });

  it("onlineCount=0 渲染「当前直播间在线 0 人」", () => {
    render(<OnlineCountText onlineCount={0} />);
    expect(screen.getByText("当前有 0 考子在线")).toBeTruthy();
  });
});
