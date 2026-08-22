import "@testing-library/jest-dom/vitest";

// jsdom 无 ResizeObserver，提供最小 mock 供 useContainerWidth 等 hook 测试
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    private callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
