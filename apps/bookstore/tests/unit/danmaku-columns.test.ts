// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  COLUMNS_STORAGE_KEY,
  DEFAULT_COLUMNS,
  loadColumns,
  saveColumns,
} from "@/features/danmaku/columns";
import type { ColumnConfig } from "@/features/danmaku/types";

describe("danmaku columns 栏位配置", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时回退默认 3 栏（礼物+上船 | SC | 弹幕）", () => {
    const columns = loadColumns();
    expect(columns).toEqual(DEFAULT_COLUMNS);
    expect(columns).toHaveLength(3);
    expect(columns[0].types).toEqual(["gift", "guard_buy"]);
    expect(columns[1].types).toEqual(["super_chat"]);
    expect(columns[2].types).toEqual(["danmaku"]);
  });

  it("存储为非法 JSON 时回退默认", () => {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, "{not json");
    expect(loadColumns()).toEqual(DEFAULT_COLUMNS);
  });

  it("存储结构不合法（未知事件类型）时回退默认", () => {
    window.localStorage.setItem(
      COLUMNS_STORAGE_KEY,
      JSON.stringify([{ id: "a", types: ["danmaku", "unknown_type"] }]),
    );
    expect(loadColumns()).toEqual(DEFAULT_COLUMNS);
  });

  it("存储结构不合法（types 为空数组 / 非数组 / 缺 id）时回退默认", () => {
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([{ id: "a", types: [] }]));
    expect(loadColumns()).toEqual(DEFAULT_COLUMNS);

    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify({ id: "a", types: ["danmaku"] }));
    expect(loadColumns()).toEqual(DEFAULT_COLUMNS);

    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify([{ types: ["danmaku"] }]));
    expect(loadColumns()).toEqual(DEFAULT_COLUMNS);
  });

  it("合法配置原样返回", () => {
    const custom: ColumnConfig[] = [
      { id: "all", types: ["danmaku", "super_chat", "gift", "guard_buy"] },
      { id: "sc", types: ["super_chat"] },
    ];
    window.localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(custom));
    expect(loadColumns()).toEqual(custom);
  });

  it("saveColumns 写入后可读回", () => {
    const custom: ColumnConfig[] = [
      { id: "dm", types: ["danmaku"] },
      { id: "guard", types: ["guard_buy"] },
      { id: "gift", types: ["gift"] },
      { id: "sc", types: ["super_chat"] },
    ];
    saveColumns(custom);
    expect(loadColumns()).toEqual(custom);
  });
});
