// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import Plate from "@/components/ui/Plate";

vi.mock("next/image", () => ({
  default: ({ src, alt, ...rest }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src as string} alt={alt as string} {...rest} />
  ),
}));

describe("Plate", () => {
  afterEach(() => cleanup());

  it("figure + figcaption 结构，题注含编号", () => {
    const { container } = render(
      <Plate src="/x.webp" alt="立绘" width={500} height={1000} index={1} caption="standing-01 · 立绘" />,
    );
    expect(container.querySelector("figure")).toBeTruthy();
    const caption = container.querySelector("figcaption")!;
    expect(caption.textContent).toContain("图版 01");
    expect(caption.textContent).toContain("standing-01");
  });

  it('as="div" 不产生 figcaption', () => {
    const { container } = render(
      <Plate as="div" src="/x.webp" alt="立绘" width={500} height={1000} caption="立绘" />,
    );
    expect(container.querySelector("figcaption")).toBeNull();
    expect(container.querySelector("span")?.textContent).toContain("立绘");
  });

  it("fit=contain 使用同色内衬", () => {
    const { container } = render(
      <Plate src="/x.webp" alt="立绘" width={500} height={1000} fit="contain" />,
    );
    expect(container.querySelector(".bg-soft")).toBeTruthy();
    expect(container.querySelector("img")?.className).toContain("object-contain");
  });

  it("priority / sizes 透传，无 rounded-lg / shadow", () => {
    const { container } = render(
      <Plate src="/x.webp" alt="立绘" width={500} height={1000} priority sizes="100vw" />,
    );
    const img = container.querySelector("img")!;
    expect(img.getAttribute("sizes")).toBe("100vw");
    expect(container.innerHTML).not.toContain("rounded-lg");
    expect(container.innerHTML).not.toContain("shadow");
  });
});
