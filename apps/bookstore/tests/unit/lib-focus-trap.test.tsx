// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { useRef } from "react";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { focusablesIn, useFocusTrap } from "@/lib/useFocusTrap";

function Trap({ active, lockScroll = true, onEscape }: { active: boolean; lockScroll?: boolean; onEscape?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active, { lockScroll, onEscape });
  return (
    <div>
      <button>触发</button>
      <div ref={ref} data-testid="trap" tabIndex={-1}>
        <button>一</button>
        <button disabled>禁用</button>
        <button hidden>隐藏</button>
        <a href="#x">二</a>
      </div>
    </div>
  );
}

describe("focusablesIn", () => {
  afterEach(() => cleanup());

  it("过滤禁用与隐藏元素", () => {
    const { container } = render(
      <div>
        <button>一</button>
        <button disabled>禁用</button>
        <button hidden>隐藏</button>
        <a href="#x">二</a>
      </div>,
    );
    const items = focusablesIn(container.firstElementChild as HTMLElement);
    expect(items.map((el) => el.textContent)).toEqual(["一", "二"]);
  });
});

describe("useFocusTrap", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("打开时聚焦首个可聚焦元素，关闭后焦点归还", () => {
    const { rerender } = render(<Trap active={false} />);
    const trigger = screen.getByRole("button", { name: "触发" });
    trigger.focus();
    rerender(<Trap active />);
    expect(document.activeElement?.textContent).toBe("一");
    rerender(<Trap active={false} />);
    expect(document.activeElement).toBe(trigger);
  });

  it("Tab 末尾回卷、Shift+Tab 开头回卷", () => {
    render(<Trap active />);
    const last = screen.getByRole("link", { name: "二" });
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement?.textContent).toBe("一");
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("Esc 触发关闭回调", () => {
    const onEscape = vi.fn();
    render(<Trap active onEscape={onEscape} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("lockScroll 置 body overflow hidden 并复原", () => {
    const { rerender } = render(<Trap active />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Trap active={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("lockScroll=false 不改 body overflow", () => {
    render(<Trap active lockScroll={false} />);
    expect(document.body.style.overflow).toBe("");
  });
});
