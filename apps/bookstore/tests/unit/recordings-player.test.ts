import { describe, it, expect, vi, beforeEach } from "vitest";

interface MockPlayer {
  destroy: ReturnType<typeof vi.fn>;
  attachMediaElement: ReturnType<typeof vi.fn>;
  load: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  seekToByteOffset?: ReturnType<typeof vi.fn>;
}

const mp = vi.hoisted(() => {
  const players: MockPlayer[] = [];
  const createPlayer = vi.fn(() => {
    const player: MockPlayer = {
      destroy: vi.fn(),
      attachMediaElement: vi.fn(),
      load: vi.fn(),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      seekToByteOffset: vi.fn(),
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

import { play, destroyPlayer, seekToByteOffset } from "@/features/recordings/player";

const fakeVideo = () => ({}) as unknown as HTMLVideoElement;

beforeEach(() => {
  destroyPlayer();
  mp.players.length = 0;
  mp.createPlayer.mockClear();
  mp.isSupported.mockReturnValue(true);
});

describe("player.seekToByteOffset 桥接", () => {
  it("有 player 实例时转发到 patched 实例方法一次", async () => {
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false });
    seekToByteOffset(1234, 5678);
    expect(mp.players[0].seekToByteOffset).toHaveBeenCalledTimes(1);
    expect(mp.players[0].seekToByteOffset).toHaveBeenCalledWith(1234, 5678);
  });

  it("无实例时静默忽略（幂等）", () => {
    expect(() => seekToByteOffset(1, 2)).not.toThrow();
  });

  it("destroyPlayer 后调用为零操作", async () => {
    await play("https://rec.example.com/a.flv", fakeVideo(), { isLive: false });
    destroyPlayer();
    seekToByteOffset(1, 2);
    expect(mp.players[0].seekToByteOffset).not.toHaveBeenCalled();
  });

  it("patch 未生效（实例无该方法）时安全返回不抛错", async () => {
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
    expect(() => seekToByteOffset(1, 2)).not.toThrow();
  });
});
