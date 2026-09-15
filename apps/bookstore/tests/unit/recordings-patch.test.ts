import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * mpegts.js 本地补丁暴露的 seek 防死锁核心（`__sumireApplyByteOffsetSeek`）行为测试。
 * 补丁为浏览器 bundle，需先注入 `self`/`window` 才能在 node 测试环境加载。
 */
type GuardFn = (player: unknown, fileposition: number, milliseconds: number) => void;

async function loadGuard(): Promise<GuardFn> {
  const g = globalThis as unknown as { self?: unknown; window?: unknown };
  g.self ??= globalThis;
  g.window ??= globalThis;
  const mod = (await import("mpegts.js")).default as unknown as { __sumireApplyByteOffsetSeek: GuardFn };
  return mod.__sumireApplyByteOffsetSeek;
}

function makeEmitter() {
  const listeners = new Map<string, Set<() => void>>();
  return {
    on: (event: string, listener: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    },
    emit: (event: string) => {
      for (const listener of [...(listeners.get(event) ?? [])]) listener();
    },
  };
}

function makeEngine() {
  const emitter = makeEmitter();
  const controller = {
    _loadSegment: vi.fn(),
    _internalAbort: vi.fn(),
    _remuxer: { seek: vi.fn(), insertDiscontinuity: vi.fn() },
    _pendingResolveSeekPoint: null as number | null,
  };
  const config: Record<string, unknown> = { lazyLoad: true, lazyLoadMaxDuration: 50 };
  const engine = {
    _config: config,
    _transmuxer: { on: emitter.on, off: emitter.off, _controller: controller },
    _mse_controller: { flush: vi.fn() },
    _seeking_handler: { directSeek: vi.fn() },
    _media_element: { currentTime: 0 },
  };
  return { engine, controller, config, emitter };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("mpegts patch: seek 防 lazyLoad 暂停死锁", () => {
  it("seek 期间关闭 lazyLoad、flush/续段/对齐 currentTime，RECOMMEND_SEEKPOINT 后恢复", async () => {
    const guard = await loadGuard();
    const { engine, controller, config, emitter } = makeEngine();

    guard({ _player_engine: engine }, 1234, 60_000);

    expect(config.lazyLoad).toBe(false);
    expect(engine._mse_controller.flush).toHaveBeenCalledTimes(1);
    expect(controller._internalAbort).toHaveBeenCalledTimes(1);
    expect(controller._remuxer.seek).toHaveBeenCalledWith(60_000);
    expect(controller._remuxer.insertDiscontinuity).toHaveBeenCalledTimes(1);
    expect(controller._loadSegment).toHaveBeenCalledWith(0, 1234);
    expect(controller._pendingResolveSeekPoint).toBe(60_000);
    expect(engine._seeking_handler.directSeek).toHaveBeenCalledWith(60);

    emitter.emit("recommend_seekpoint");
    expect(config.lazyLoad).toBe(true);
  });

  it("音频媒体段到达时仍保持 lazyLoad 关闭（不触发暂停判定）", async () => {
    const guard = await loadGuard();
    const { engine, config, emitter } = makeEngine();

    guard({ _player_engine: engine }, 0, 10_000);
    // 首个到达段为音频：LoadingController 的暂停判定被 lazyLoad=false 短路
    emitter.emit("media_segment");
    expect(config.lazyLoad).toBe(false);
    // 直到视频关键帧触发 RECOMMEND_SEEKPOINT 才恢复
    emitter.emit("recommend_seekpoint");
    expect(config.lazyLoad).toBe(true);
  });

  it("缺少 _seeking_handler 时直接写 mediaElement.currentTime 对齐时间轴", async () => {
    const guard = await loadGuard();
    const { engine } = makeEngine();
    (engine as { _seeking_handler?: unknown })._seeking_handler = undefined;

    guard({ _player_engine: engine }, 0, 90_000);

    expect(engine._media_element.currentTime).toBe(90);
  });

  it("RECOMMEND_SEEKPOINT 未到达时超时兜底恢复 lazyLoad", async () => {
    vi.useFakeTimers();
    const guard = await loadGuard();
    const { engine, config } = makeEngine();

    guard({ _player_engine: engine }, 0, 5000);
    expect(config.lazyLoad).toBe(false);
    vi.advanceTimersByTime(20_000);
    expect(config.lazyLoad).toBe(true);
  });

  it("内部结构不符时抛错且不改变 lazyLoad", async () => {
    const guard = await loadGuard();
    const config: Record<string, unknown> = { lazyLoad: true };
    expect(() => guard({ _player_engine: { _config: config } }, 0, 0)).toThrow();
    expect(config.lazyLoad).toBe(true);
  });

  it("directSeek 抛错时恢复 lazyLoad 并向上抛（由应用层显性失败）", async () => {
    const guard = await loadGuard();
    const { engine, config } = makeEngine();
    engine._seeking_handler.directSeek.mockImplementation(() => {
      throw new Error("align failed");
    });

    expect(() => guard({ _player_engine: engine }, 0, 1000)).toThrow("align failed");
    expect(config.lazyLoad).toBe(true);
  });
});
