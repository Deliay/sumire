import { describe, it, expect, vi, afterEach } from "vitest";
import {
  estimateByteOffset,
  findNextTagBoundary,
  seekUnbuffered,
  SEEK_WINDOW_BYTES,
  MAX_WINDOW_READ_BYTES,
} from "@/features/recordings/seek";

/** 构造一个合法 FLV tag：header(11) + data(dataSize) + PrevTagSize(4)。 */
function buildTag(type: 8 | 9 | 18, dataSize: number, timestampMs: number, dataFill = 0): Uint8Array {
  const tag = new Uint8Array(11 + dataSize + 4);
  tag[0] = type;
  tag[1] = (dataSize >> 16) & 0xff;
  tag[2] = (dataSize >> 8) & 0xff;
  tag[3] = dataSize & 0xff;
  const low24 = timestampMs & 0xffffff;
  tag[4] = (low24 >> 16) & 0xff;
  tag[5] = (low24 >> 8) & 0xff;
  tag[6] = low24 & 0xff;
  tag[7] = (timestampMs >>> 24) & 0xff;
  // bytes 8-10 StreamID = 0
  for (let i = 0; i < dataSize; i++) tag[11 + i] = dataFill;
  const prev = 11 + dataSize;
  tag[11 + dataSize] = (prev >>> 24) & 0xff;
  tag[12 + dataSize] = (prev >>> 16) & 0xff;
  tag[13 + dataSize] = (prev >>> 8) & 0xff;
  tag[14 + dataSize] = prev & 0xff;
  return tag;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

function windowResponse(bytes: Uint8Array, status = 206, contentRange?: string, contentLength?: string) {
  const headers: Record<string, string> = {};
  if (contentRange) headers["content-range"] = contentRange;
  if (contentLength) headers["content-length"] = contentLength;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("estimateByteOffset", () => {
  it("线性估算并按文件大小钳制", () => {
    expect(estimateByteOffset(0, 100_000, 1_000_000)).toBe(0);
    expect(estimateByteOffset(50_000, 100_000, 1_000_000)).toBe(500_000);
    expect(estimateByteOffset(100_000, 100_000, 1_000_000)).toBe(999_999);
  });

  it("非法输入返回 0", () => {
    expect(estimateByteOffset(1000, 0, 1_000_000)).toBe(0);
    expect(estimateByteOffset(1000, 100_000, 0)).toBe(0);
    expect(estimateByteOffset(Number.NaN, 100_000, 1_000_000)).toBe(0);
  });

  it("超出时长的目标钳制到文件末尾附近", () => {
    expect(estimateByteOffset(999_999, 100_000, 1_000_000)).toBe(999_999);
  });
});

describe("findNextTagBoundary", () => {
  it("跳过前导噪声，定位首个三重校验通过的 tag 边界并读出时间戳", () => {
    const window = concat(new Uint8Array([1, 2, 3, 4, 5, 6, 7]), buildTag(9, 20, 5000), buildTag(9, 20, 5050));
    const boundary = findNextTagBoundary(window, 1_000_000);
    expect(boundary).toEqual({ fileposition: 1_000_007, milliseconds: 5000 });
  });

  it("纯噪声窗口返回 null", () => {
    const noise = new Uint8Array(2000);
    noise.fill(0x01);
    expect(findNextTagBoundary(noise, 0)).toBeNull();
  });

  it("假 tagType 字节（PrevTagSize 不一致）被跳过，命中真实边界", () => {
    const fake = new Uint8Array([9, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0]);
    const window = concat(fake, buildTag(18, 10, 1234));
    const boundary = findNextTagBoundary(window, 500);
    expect(boundary).toEqual({ fileposition: 500 + fake.length, milliseconds: 1234 });
  });

  it("窗口尾部截断（不足以校验 PrevTagSize）放宽为单重校验", () => {
    const full = buildTag(8, 40, 777);
    const truncated = full.slice(0, 20);
    const boundary = findNextTagBoundary(truncated, 100);
    expect(boundary).toEqual({ fileposition: 100, milliseconds: 777 });
  });
});

describe("seekUnbuffered", () => {
  it("估算偏移 → Range 窗口探测 → tag 边界对齐 → 调用 seekToByteOffset", async () => {
    const window = concat(new Uint8Array([0, 0, 0]), buildTag(9, 30, 60_000), buildTag(9, 30, 60_040));
    const fetchMock = vi.fn().mockResolvedValue(windowResponse(window));
    vi.stubGlobal("fetch", fetchMock);
    const seek = vi.fn();

    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 60,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://rec.example.com/a.flv");
    expect(init.headers.Range).toBe(`bytes=500000-${500000 + SEEK_WINDOW_BYTES - 1}`);
    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(500_003, 60_000);
  });

  it("fetch 失败返回 false 且不触达播放器", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const seek = vi.fn();
    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 10,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(ok).toBe(false);
    expect(seek).not.toHaveBeenCalled();
  });

  it("非 206 响应（上游忽略 Range）取消响应体、绝不整文件 buffer 且不触达播放器", async () => {
    const cancel = vi.fn(async () => {});
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => null }, body: { cancel }, arrayBuffer }),
    );
    const seek = vi.fn();
    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 10,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(ok).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
  });

  it("Content-Length 超出窗口读取上限时取消并降级", async () => {
    const window = concat(buildTag(9, 16, 10), buildTag(9, 16, 20));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        windowResponse(window, 206, undefined, String(SEEK_WINDOW_BYTES * 10)),
      ),
    );
    const seek = vi.fn();
    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 10,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(ok).toBe(false);
    expect(seek).not.toHaveBeenCalled();
  });

  it("流式读取超出上限时取消读取器并降级", async () => {
    const cancel = vi.fn(async () => {});
    const hugeChunk = new Uint8Array(MAX_WINDOW_READ_BYTES + 1);
    let step = 0;
    const reader = {
      read: vi.fn(async () => {
        step += 1;
        if (step === 1) return { done: false, value: hugeChunk };
        return { done: true, value: undefined };
      }),
      cancel,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 206,
        headers: { get: () => null },
        body: { getReader: () => reader },
      }),
    );
    const seek = vi.fn();
    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 10,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(ok).toBe(false);
    expect(cancel).toHaveBeenCalled();
    expect(seek).not.toHaveBeenCalled();
  });

  it("patched 回调返回 false（补丁未生效）时显性失败", async () => {
    const window = concat(new Uint8Array([0, 0, 0]), buildTag(9, 16, 60_000));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(windowResponse(window)));
    const seek = vi.fn(() => false);
    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 60,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(ok).toBe(false);
    expect(seek).toHaveBeenCalledTimes(1);
  });

  it("窗口内扫描失败降级为「从估算偏移直接尝试」并返回 false", async () => {
    const noise = new Uint8Array(4096);
    noise.fill(0x02);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(windowResponse(noise)));
    const seek = vi.fn();
    const ok = await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 30,
      durationSeconds: 120,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(ok).toBe(false);
    expect(seek).toHaveBeenCalledWith(250_000, 30_000);
  });

  it("目标超出时长时钳制到末尾附近", async () => {
    const window = concat(buildTag(9, 16, 10), buildTag(9, 16, 20));
    const fetchMock = vi.fn().mockResolvedValue(windowResponse(window));
    vi.stubGlobal("fetch", fetchMock);
    const seek = vi.fn();
    await seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 999,
      durationSeconds: 100,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    expect(fetchMock.mock.calls[0][1].headers.Range).toBe(`bytes=999999-${999999 + SEEK_WINDOW_BYTES - 1}`);
  });

  it("连续快速 seek 时仅最后一次结果触达播放器（last-wins）", async () => {
    const windowA = concat(new Uint8Array([0, 0, 0, 0, 0]), buildTag(9, 16, 1000));
    const windowB = concat(new Uint8Array([0, 0, 0, 0, 0]), buildTag(9, 16, 2000));
    let resolveFirst!: (v: unknown) => void;
    const first = new Promise((r) => {
      resolveFirst = r;
    });
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(windowResponse(windowB));
    vi.stubGlobal("fetch", fetchMock);
    const seek = vi.fn();

    const p1 = seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 10,
      durationSeconds: 100,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });
    const p2 = seekUnbuffered({
      url: "https://rec.example.com/a.flv",
      targetSeconds: 80,
      durationSeconds: 100,
      fileSize: 1_000_000,
      seekToByteOffset: seek,
    });

    resolveFirst(windowResponse(windowA));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r2).toBe(true);
    expect(r1).toBe(false);
    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(800_005, 2000);
  });
});
