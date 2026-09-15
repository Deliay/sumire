import { describe, it, expect, vi, afterEach } from "vitest";

/** 以指定基址重新加载 api 模块（模块级读取 env，需 resetModules）。 */
async function loadApi(base: string) {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_RECORDINGS_BASE_URL", base);
  return await import("@/features/recordings/api");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("recordings api 基址门控", () => {
  it("未配置基址：RECORDINGS_CONFIGURED=false，两个取数函数短路且不 fetch", async () => {
    const api = await loadApi("");
    expect(api.RECORDINGS_CONFIGURED).toBe(false);
    expect(api.RECORDINGS_BASE_URL).toBe("");

    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);

    expect(await api.getRecordingStatus()).toEqual({ ok: false, items: [] });
    expect(await api.getRoomRecordings(123)).toEqual({ ok: false, files: [] });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("recordings api 归一化", () => {
  it("recording-status：streamer.name→streamerName、未知 state→not_live、缺 sessionTitle→null、去内部字段", async () => {
    const api = await loadApi("https://rec.example.com");
    const spy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        items: [
          {
            mid: 1,
            roomId: 2,
            state: "weird_state",
            hostName: "internal-host",
            sessionTitle: undefined,
            error: "some internal error",
            updatedAt: "2026-09-14T00:00:00.000Z",
            streamer: { name: "枝堇" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", spy);

    const res = await api.getRecordingStatus();
    expect(res.ok).toBe(true);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      mid: 1,
      roomId: 2,
      streamerName: "枝堇",
      state: "not_live",
      sessionTitle: null,
      updatedAt: "2026-09-14T00:00:00.000Z",
    });
    expect(res.items[0]).not.toHaveProperty("hostName");
    expect(res.items[0]).not.toHaveProperty("error");
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toBe("https://rec.example.com/api/b/live/recording-status");
  });

  it("recording-status 保留 recording 状态与 sessionTitle", async () => {
    const api = await loadApi("https://rec.example.com/");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({
          items: [
            {
              mid: 9,
              roomId: 8,
              state: "recording",
              sessionTitle: "夜读",
              updatedAt: "2026-09-14T01:00:00.000Z",
              streamer: { name: "店主" },
            },
          ],
        }),
      }),
    );
    const res = await api.getRecordingStatus();
    expect(res.items[0]).toMatchObject({ state: "recording", sessionTitle: "夜读" });
  });

  it("recordings：归一化文件列表并编码请求路径", async () => {
    const api = await loadApi("https://rec.example.com");
    const spy = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        files: [
          { name: "中文 文件.flv", size: 1024, createdAt: "2026-09-14T00:00:00.000Z" },
          { bad: true },
        ],
      }),
    });
    vi.stubGlobal("fetch", spy);

    const res = await api.getRoomRecordings(42);
    expect(res.ok).toBe(true);
    expect(res.files).toEqual([
      { name: "中文 文件.flv", size: 1024, createdAt: "2026-09-14T00:00:00.000Z" },
    ]);
    expect(spy.mock.calls[0][0]).toBe("https://rec.example.com/api/b/live/42/recordings");
  });
});

describe("recordings api 降级", () => {
  it("非 200 返回降级值", async () => {
    const api = await loadApi("https://rec.example.com");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 500, json: async () => ({}) }));
    expect(await api.getRecordingStatus()).toEqual({ ok: false, items: [] });
    expect(await api.getRoomRecordings(1)).toEqual({ ok: false, files: [] });
  });

  it("非法 JSON 返回降级值", async () => {
    const api = await loadApi("https://rec.example.com");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );
    expect(await api.getRecordingStatus()).toEqual({ ok: false, items: [] });
  });

  it("fetch reject 不抛错，返回降级值", async () => {
    const api = await loadApi("https://rec.example.com");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await api.getRecordingStatus()).toEqual({ ok: false, items: [] });
    expect(await api.getRoomRecordings(1)).toEqual({ ok: false, files: [] });
  });
});

describe("recordings api URL 构造", () => {
  it("joinUrl：基址带/不带末尾斜杠均拼出单斜杠路径", async () => {
    const api = await loadApi("https://rec.example.com");
    expect(api.joinUrl("https://rec.example.com", "/api/b/live/recording-status")).toBe(
      "https://rec.example.com/api/b/live/recording-status",
    );
    expect(api.joinUrl("https://rec.example.com/", "/api/b/live/recording-status")).toBe(
      "https://rec.example.com/api/b/live/recording-status",
    );
  });

  it("liveAudioUrl / recordingFileUrl 基于基址且文件名经 encodeURIComponent", async () => {
    const api = await loadApi("https://rec.example.com/");
    expect(api.liveAudioUrl(42)).toBe("https://rec.example.com/api/b/live/42/live-stream/audio");
    expect(api.recordingFileUrl(42, "中文 文件.flv")).toBe(
      `https://rec.example.com/api/b/live/42/recordings/${encodeURIComponent("中文 文件.flv")}`,
    );
  });
});
