import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

interface MockPlayer {
  destroy: ReturnType<typeof vi.fn>;
  attachMediaElement: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  seekToByteOffset?: ReturnType<typeof vi.fn>;
  setBufferLimits?: ReturnType<typeof vi.fn>;
}

const mp = vi.hoisted(() => {
  const players: MockPlayer[] = [];
  const createPlayer = vi.fn<(source: unknown, config?: unknown) => MockPlayer>(() => {
    const player: MockPlayer = {
      destroy: vi.fn(),
      attachMediaElement: vi.fn(),
      load: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      seekToByteOffset: vi.fn(),
      setBufferLimits: vi.fn(),
    };
    players.push(player);
    return player;
  });
  return { players, createPlayer, isSupported: vi.fn(() => true) };
});

vi.mock("mpegts.js", () => ({
  default: {
    createPlayer: mp.createPlayer,
    isSupported: mp.isSupported,
    Events: { ERROR: "error" },
  },
}));

import {
  play,
  destroyPlayer,
  seekToByteOffset,
  configureBufferForBitrate,
  computeBufferConfig,
} from "@/features/recordings/player";

const fakeVideo = () => ({}) as unknown as HTMLVideoElement;

beforeEach(() => {
  destroyPlayer();
  mp.players.length = 0;
  mp.createPlayer.mockClear();
  mp.isSupported.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("computeBufferConfig", () => {
  it("未知码率用保守默认值折算（≈41s 前瞻，≤50MB@10Mbps）", () => {
    expect(computeBufferConfig(0, 0).lazyLoadMaxDuration).toBe(41);
    expect(computeBufferConfig(1_000_000, 0).lazyLoadMaxDuration).toBe(41);
  });

  it("按 size/duration 估算码率折算缓冲秒数", () => {
    // 400Mbit 预算 / 10Mbps = 40s
    const cfg = computeBufferConfig(50 * 1024 * 1024, 40);
    expect(cfg.lazyLoadMaxDuration).toBe(40);
    expect(cfg.autoCleanupMaxBackwardDuration).toBe(40);
    expect(cfg.autoCleanupMinBackwardDuration).toBeLessThan(cfg.autoCleanupMaxBackwardDuration);
  });

  it("低码率时钳制到上限、且各项为正", () => {
    const cfg = computeBufferConfig(50 * 1024 * 1024, 5000);
    expect(cfg.lazyLoadMaxDuration).toBe(120);
    expect(cfg.lazyLoadRecoverDuration).toBeGreaterThan(0);
    expect(cfg.autoCleanupMinBackwardDuration).toBeGreaterThan(0);
  });

  it("高码率时钳制到下限（防止缓冲过小）", () => {
    const cfg = computeBufferConfig(500 * 1024 * 1024, 100);
    expect(cfg.lazyLoadMaxDuration).toBe(30);
  });
});

describe("play 缓冲封顶", () => {
  it("录播（非直播）createPlayer 显式传 buffer config", async () => {
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false, fileSize: 1024 });
    expect(mp.createPlayer).toHaveBeenCalledTimes(1);
    const [source, config] = mp.createPlayer.mock.calls[0];
    expect(source).toMatchObject({ type: "flv", isLive: false });
    expect(config).toMatchObject({ lazyLoadMaxDuration: computeBufferConfig(0, 0).lazyLoadMaxDuration });
  });

  it("直播不传 buffer config（保持 mpegts 默认）", async () => {
    await play("https://rec.example.com/live.flv", fakeVideo(), { isLive: true });
    expect(mp.createPlayer.mock.calls[0][1]).toBeUndefined();
  });

  it("configureBufferForBitrate 转发到 patched setBufferLimits", async () => {
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false, fileSize: 1024 });
    const ok = configureBufferForBitrate(50 * 1024 * 1024, 5000);
    expect(ok).toBe(true);
    expect(mp.players[0].setBufferLimits).toHaveBeenCalledWith(
      expect.objectContaining({ lazyLoadMaxDuration: 120 }),
    );
  });
});

describe("player.seekToByteOffset 桥接", () => {
  it("有 player 实例时转发到 patched 实例方法一次并返回 true", async () => {
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false });
    const ok = seekToByteOffset(1234, 5678);
    expect(ok).toBe(true);
    expect(mp.players[0].seekToByteOffset).toHaveBeenCalledTimes(1);
    expect(mp.players[0].seekToByteOffset).toHaveBeenCalledWith(1234, 5678);
  });

  it("无实例时显性失败（返回 false 并记录错误）", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(seekToByteOffset(1, 2)).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it("destroyPlayer 后调用为零操作且返回 false", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false });
    destroyPlayer();
    expect(seekToByteOffset(1, 2)).toBe(false);
    expect(mp.players[0].seekToByteOffset).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it("patch 未生效（实例无该方法）时显性失败、不抛错", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mp.createPlayer.mockImplementationOnce(() => {
      const player: MockPlayer = {
        destroy: vi.fn(),
        attachMediaElement: vi.fn(),
        load: vi.fn(),
        play: vi.fn(() => Promise.resolve()),
        pause: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
      };
      mp.players.push(player);
      return player;
    });
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false });
    expect(seekToByteOffset(1, 2)).toBe(false);
    expect(spy).toHaveBeenCalled();
  });

  it("patched 方法抛错时捕获、显性记录并返回 false", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false });
    mp.players[0].seekToByteOffset!.mockImplementation(() => {
      throw new Error("unexpected internal structure");
    });
    expect(seekToByteOffset(1, 2)).toBe(false);
    expect(spy).toHaveBeenCalled();
  });
});
