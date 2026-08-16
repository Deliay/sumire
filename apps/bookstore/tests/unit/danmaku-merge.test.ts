import { describe, it, expect } from "vitest";
import { longestNonRepeatSubstring, mergeDanmaku, danmakuMergeKey } from "@/features/danmaku/merge";
import type { LiveEvent } from "@/features/danmaku/types";

const SENDER: LiveEvent["sender"] = { uid: 1, name: "观众A", nameRomaji: null, face: null, medal: null, guardLevel: null };

function dm(id: string, content: string, emote?: { url: string; name?: string }): LiveEvent {
  return { eventId: id, type: "danmaku", occurredAt: "2026-08-16T12:00:00.000Z", sender: SENDER, read: false, content, emote };
}

describe("longestNonRepeatSubstring 最长无重复子串", () => {
  it("全重复字符取单字符", () => {
    expect(longestNonRepeatSubstring("妈妈妈妈妈")).toBe("妈");
    expect(longestNonRepeatSubstring("妈妈妈")).toBe("妈");
    expect(longestNonRepeatSubstring("妈妈")).toBe("妈");
  });

  it("常规文本取最长无重复片段", () => {
    expect(longestNonRepeatSubstring("abcabcbb")).toBe("abc");
    expect(longestNonRepeatSubstring("你好你好")).toBe("你好");
  });

  it("空串返回空串", () => {
    expect(longestNonRepeatSubstring("")).toBe("");
  });
});

describe("danmakuMergeKey", () => {
  it("表情弹幕以 emote url 为键", () => {
    expect(danmakuMergeKey(dm("a", "x", { url: "http://u/1.png" }))).toBe("emote:http://u/1.png");
  });

  it("文字弹幕以最长非重复子串为键", () => {
    expect(danmakuMergeKey(dm("a", "妈妈妈妈妈"))).toBe("text:妈");
    expect(danmakuMergeKey(dm("b", "妈妈妈"))).toBe("text:妈");
  });

  it("非弹幕返回 null", () => {
    const gift: LiveEvent = { ...dm("a", "x"), type: "gift", gift: { name: "情书", count: 1 }, price: 1 };
    expect(danmakuMergeKey(gift)).toBeNull();
  });
});

describe("mergeDanmaku 弹幕折叠", () => {
  it("相邻重复表情折叠并计数（代表行停在末次出现的原位）", () => {
    const rows = mergeDanmaku([
      dm("a", "[比心]", { url: "http://u/1.png" }),
      dm("b", "[比心]", { url: "http://u/1.png" }),
      dm("c", "[比心]", { url: "http://u/1.png" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
    expect(rows[0].event.eventId).toBe("c");
  });

  it("相邻重复文字折叠（4.2：妈妈妈妈妈/妈妈妈/妈妈）", () => {
    const rows = mergeDanmaku([dm("a", "妈妈妈妈妈"), dm("b", "妈妈妈"), dm("c", "妈妈")]);
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(3);
  });

  it("不同键不折叠", () => {
    const rows = mergeDanmaku([dm("a", "来了来了"), dm("b", "欢迎欢迎")]);
    expect(rows).toHaveLength(2);
    expect(rows[0].count).toBe(1);
    expect(rows[1].count).toBe(1);
  });

  it("跨其他事件（非连续）的重复同样折叠，保留末次出现位置并累计计数", () => {
    const gift: LiveEvent = { ...dm("mid", "x"), type: "gift", gift: { name: "情书", count: 1 }, price: 1 };
    const rows = mergeDanmaku([dm("a", "妈妈"), gift, dm("b", "妈妈"), dm("c", "你好")]);
    expect(rows).toHaveLength(3);
    expect(rows[0].event.type).toBe("gift");
    expect(rows[1].event.eventId).toBe("b");
    expect(rows[1].count).toBe(2);
    expect(rows[2].event.eventId).toBe("c");
  });

  it("SSE 新到的重复弹幕折叠到已展示的末次出现处，不跳到顶部（倒序列表场景）", () => {
    const rows = mergeDanmaku([
      dm("new", "妈妈"), // SSE 刚 prepend 到顶部的新重复
      dm("w", "欢迎欢迎"),
      dm("old", "妈妈"), // 用户正在浏览的旧出现
    ]);
    expect(rows.map((r) => r.event.eventId)).toEqual(["w", "old"]);
    const folded = rows[1];
    expect(folded.count).toBe(2);
  });

  it("非弹幕原样透传（count=1）", () => {
    const gift: LiveEvent = { ...dm("g", "x"), type: "gift", gift: { name: "情书", count: 1 }, price: 1 };
    const rows = mergeDanmaku([dm("a", "你好"), gift, dm("b", "再见")]);
    expect(rows.map((r) => r.count)).toEqual([1, 1, 1]);
    expect(rows.map((r) => r.event.type)).toEqual(["danmaku", "gift", "danmaku"]);
  });
});
