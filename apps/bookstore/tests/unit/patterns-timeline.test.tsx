// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Timeline from "@/components/patterns/Timeline";

const items = [
  { key: "1", date: "2025-01-01", title: "开始活动", note: "首次投稿" },
  { key: "2", date: "2026-08-05", title: "二十八期出道", current: true },
];

describe("Timeline", () => {
  afterEach(() => cleanup());

  it("ol / li / time dateTime 语义", () => {
    const { container } = render(<Timeline items={items} />);
    expect(container.querySelector("ol")).toBeTruthy();
    expect(container.querySelectorAll("li")).toHaveLength(2);
    const time = container.querySelector("time")!;
    expect(time.getAttribute("dateTime")).toBe("2025-01-01");
  });

  it("日期列与内容列、当前项 primary", () => {
    const { container } = render(<Timeline items={items} />);
    const li = container.querySelectorAll("li")[0]!;
    expect(li.className).toContain("sm:grid-cols-[8rem_1fr]");
    const current = container.querySelectorAll("time")[1]!;
    expect(current.className).toContain("text-primary");
  });

  it("移动端单列（默认 grid-cols-1）", () => {
    const { container } = render(<Timeline items={items} />);
    expect(container.querySelector("li")!.className).toContain("grid-cols-1");
  });
});
