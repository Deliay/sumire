// @vitest-environment jsdom
import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

class MockEventSource {
  static CLOSED = 2;
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  readyState = 0;
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((msg: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(url: string, opts?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  close() {
    this.closed = true;
    this.readyState = MockEventSource.CLOSED;
  }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

const DANMAKU_EVENT = {
  eventId: "dm:1",
  type: "danmaku",
  occurredAt: "2026-08-28T12:00:00.000Z",
  sender: { uid: 100, name: "甲", nameRomaji: null, face: null, medal: null, guardLevel: null },
  content: "大家好",
  read: false,
};

function makeDanmakuEvent(id: string, uid: number, content?: string) {
  return { ...DANMAKU_EVENT, eventId: id, sender: { ...DANMAKU_EVENT.sender, uid }, content };
}

describe("useDanmakuVote", () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockEventSource.instances = [];
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadHook() {
    return await import("@/features/danmaku-tools/vote/useDanmakuVote");
  }

  it("初始为空态", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());
    expect(result.current.state).toEqual({
      options: [],
      processed: 0,
      matched: 0,
      voterUids: [],
    });
    expect(result.current.voting).toBe(false);
  });

  it("预置 localStorage 后挂载恢复", async () => {
    const savedState = {
      options: [{ id: "1", name: "选项A", keyword: "唱歌", count: 5 }],
      processed: 10,
      matched: 5,
      voterUids: [123456],
    };
    window.localStorage.setItem("danmaku-tools.vote", JSON.stringify(savedState));

    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());
    expect(result.current.state).toEqual(savedState);
    expect(result.current.voting).toBe(false);
  });

  it("addOption：空名称/空关键字拒绝 + hint", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("", "唱歌");
    });
    expect(result.current.hint).toBe("名称和关键字不能为空");
    expect(result.current.state.options).toHaveLength(0);

    act(() => {
      result.current.addOption("选项A", "");
    });
    expect(result.current.hint).toBe("名称和关键字不能为空");
    expect(result.current.state.options).toHaveLength(0);
  });

  it("addOption：冲突关键字拒绝 + hint", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    expect(result.current.state.options).toHaveLength(1);

    act(() => {
      result.current.addOption("选项B", "唱歌");
    });
    expect(result.current.hint).toBe("关键字与已有选项冲突");
    expect(result.current.state.options).toHaveLength(1);
  });

  it("addOption：合法添加成功", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    expect(result.current.state.options).toHaveLength(1);
    expect(result.current.state.options[0].name).toBe("选项A");
    expect(result.current.state.options[0].keyword).toBe("唱歌");
    expect(result.current.hint).toBeNull();
  });

  it("addOption：voting 中拒绝", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });
    expect(result.current.voting).toBe(true);

    act(() => {
      result.current.addOption("选项B", "游戏");
    });
    expect(result.current.state.options).toHaveLength(1);
  });

  it("start：无选项拒绝 + hint", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.start();
    });
    expect(result.current.voting).toBe(false);
    expect(result.current.hint).toBe("请先添加投票选项");
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("start：有选项建立连接", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });
    expect(result.current.voting).toBe(true);
    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain("http://localhost:4000/api/live-events/stream?");
    expect(es.url).toContain("type=danmaku");
    expect(es.withCredentials).toBe(true);
  });

  it("计票：单命中弹幕 → 选项 count +1、matched +1、processed +1", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "大家来唱歌吧"));
    });

    expect(result.current.state.processed).toBe(1);
    expect(result.current.state.matched).toBe(1);
    expect(result.current.state.options[0].count).toBe(1);
    expect(result.current.state.voterUids).toContain(100);
  });

  it("计票：同一 uid 再次命中 → 仅 processed +1", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "大家来唱歌吧"));
      es.emit(makeDanmakuEvent("dm:2", 100, "再唱一次"));
    });

    expect(result.current.state.processed).toBe(2);
    expect(result.current.state.matched).toBe(1);
    expect(result.current.state.options[0].count).toBe(1);
    expect(result.current.state.voterUids).toHaveLength(1);
  });

  it("计票：0 命中/多命中 → 仅 processed +1", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
      result.current.addOption("选项B", "游戏");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "今天天气真好")); // 0 命中
      es.emit(makeDanmakuEvent("dm:2", 101, "唱歌和游戏都好玩")); // 多命中
    });

    expect(result.current.state.processed).toBe(2);
    expect(result.current.state.matched).toBe(0);
    expect(result.current.state.options[0].count).toBe(0);
    expect(result.current.state.options[1].count).toBe(0);
  });

  it("计票：无 content 的表情弹幕 → 仅 processed +1", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, undefined));
    });

    expect(result.current.state.processed).toBe(1);
    expect(result.current.state.matched).toBe(0);
    expect(result.current.state.options[0].count).toBe(0);
  });

  it("stop：EventSource close 被调、voting === false、统计保留", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "唱歌"));
    });

    act(() => {
      result.current.stop();
    });

    expect(es.closed).toBe(true);
    expect(result.current.voting).toBe(false);
    expect(result.current.state.processed).toBe(1);
    expect(result.current.state.matched).toBe(1);
  });

  it("clear：断开连接 + 全量空态 + localStorage 已清除", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "唱歌"));
    });

    act(() => {
      result.current.clear();
    });

    expect(es.closed).toBe(true);
    expect(result.current.state).toEqual({
      options: [],
      processed: 0,
      matched: 0,
      voterUids: [],
    });
    const saved = JSON.parse(window.localStorage.getItem("danmaku-tools.vote")!);
    expect(saved).toEqual({
      options: [],
      processed: 0,
      matched: 0,
      voterUids: [],
    });
  });

  it("卸载：close 被调", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result, unmount } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  it("状态变更后 localStorage 已回写", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });

    const saved = JSON.parse(window.localStorage.getItem("danmaku-tools.vote")!);
    expect(saved.options).toHaveLength(1);
    expect(saved.options[0].name).toBe("选项A");
  });

  it("clear 后继续操作仍持久化", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote());

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.clear();
    });

    const afterClear = JSON.parse(window.localStorage.getItem("danmaku-tools.vote")!);
    expect(afterClear).toEqual({
      options: [],
      processed: 0,
      matched: 0,
      voterUids: [],
    });

    act(() => {
      result.current.addOption("选项B", "游戏");
    });

    const saved = JSON.parse(window.localStorage.getItem("danmaku-tools.vote")!);
    expect(saved.options).toHaveLength(1);
    expect(saved.options[0].name).toBe("选项B");
  });
});

// StrictMode 回归：验证 updater 纯净（无 voterSetRef 副作用），dev 模式双调用不影响计票
describe("useDanmakuVote (StrictMode)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    MockEventSource.instances = [];
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");
    vi.stubGlobal("EventSource", MockEventSource);
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  });

  afterEach(() => {
    MockEventSource.instances = [];
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function loadHook() {
    return await import("@/features/danmaku-tools/vote/useDanmakuVote");
  }

  it("StrictMode 下首次投票 count 正常 +1", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote(), {
      wrapper: ({ children }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "大家来唱歌吧"));
    });

    // StrictMode 双调用 updater 不应导致计票丢失
    expect(result.current.state.processed).toBe(1);
    expect(result.current.state.matched).toBe(1);
    expect(result.current.state.options[0].count).toBe(1);
    expect(result.current.state.voterUids).toContain(100);
  });

  it("StrictMode 下同一 uid 重复弹幕不重复计票", async () => {
    const { useDanmakuVote } = await loadHook();
    const { result } = renderHook(() => useDanmakuVote(), {
      wrapper: ({ children }) => (
        <StrictMode>{children}</StrictMode>
      ),
    });

    act(() => {
      result.current.addOption("选项A", "唱歌");
    });
    act(() => {
      result.current.start();
    });

    const es = MockEventSource.instances[0];
    act(() => {
      es.emit(makeDanmakuEvent("dm:1", 100, "大家来唱歌吧"));
      es.emit(makeDanmakuEvent("dm:2", 100, "再唱一次"));
    });

    expect(result.current.state.processed).toBe(2);
    expect(result.current.state.matched).toBe(1);
    expect(result.current.state.options[0].count).toBe(1);
    expect(result.current.state.voterUids).toHaveLength(1);
  });
});
