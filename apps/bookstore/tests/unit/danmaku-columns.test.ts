// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  COLUMN_PRESETS,
  COLUMNS_STORAGE_KEY,
  DEFAULT_COLUMNS,
  loadColumns,
  resolveColumns,
  saveColumns,
} from "@/features/danmaku/columns";
import type { ColumnConfig } from "@/features/danmaku/types";

describe("danmaku columns 栏位配置", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("无存储时回退默认 3 栏（礼物+上船混排 | SC | 弹幕）", () => {
    const columns = loadColumns();
    expect(columns).toEqual(DEFAULT_COLUMNS);
    expect(columns).toHaveLength(3);
    expect(columns[0]).toEqual({ id: "gift_guard", types: ["gift", "guard_buy"], mode: "mixed" });
    expect(columns[1]).toEqual({ id: "sc", types: ["super_chat"], mode: "mixed" });
    expect(columns[2]).toEqual({ id: "danmaku", types: ["danmaku"], mode: "mixed" });
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

describe("danmaku columns 栏数预设 COLUMN_PRESETS", () => {
  it("1 栏预设：单栏混排全部四类（SC/上船/礼物/弹幕）", () => {
    expect(COLUMN_PRESETS[1]).toEqual([
      { id: "all", types: ["super_chat", "guard_buy", "gift", "danmaku"], mode: "mixed" },
    ]);
  });

  it("2 栏预设：上船+SC（混排）| 弹幕+礼物（混排）", () => {
    expect(COLUMN_PRESETS[2]).toEqual([
      { id: "guard_sc", types: ["guard_buy", "super_chat"], mode: "mixed" },
      { id: "gift_danmaku", types: ["gift", "danmaku"], mode: "mixed" },
    ]);
  });

  it("3 栏预设：沿用默认 3 栏（礼物+上船混排 | SC | 弹幕）", () => {
    expect(COLUMN_PRESETS[3]).toEqual(DEFAULT_COLUMNS);
  });
});

describe("danmaku columns 视口栏数自适应 resolveColumns", () => {
  const one: ColumnConfig[] = [{ id: "all", types: ["danmaku", "super_chat", "gift", "guard_buy"] }];
  const two: ColumnConfig[] = [
    { id: "a", types: ["guard_buy", "super_chat"] },
    { id: "b", types: ["gift", "danmaku"] },
  ];
  const four: ColumnConfig[] = [
    { id: "a", types: ["danmaku"] },
    { id: "b", types: ["super_chat"] },
    { id: "c", types: ["gift"] },
    { id: "d", types: ["guard_buy"] },
  ];

  it("narrow（<640）：单栏原样保留，多栏折叠为单栏预设", () => {
    expect(resolveColumns(one, "narrow")).toEqual(one);
    expect(resolveColumns(two, "narrow")).toEqual(COLUMN_PRESETS[1]);
    expect(resolveColumns(DEFAULT_COLUMNS, "narrow")).toEqual(COLUMN_PRESETS[1]);
    expect(resolveColumns(four, "narrow")).toEqual(COLUMN_PRESETS[1]);
  });

  it("medium（640-1023）：1/2 栏原样保留，3+ 栏折叠为单栏预设", () => {
    expect(resolveColumns(one, "medium")).toEqual(one);
    expect(resolveColumns(two, "medium")).toEqual(two);
    expect(resolveColumns(DEFAULT_COLUMNS, "medium")).toEqual(COLUMN_PRESETS[1]);
    expect(resolveColumns(four, "medium")).toEqual(COLUMN_PRESETS[1]);
  });

  it("wide（>=1024）：2/3/更多栏原样保留，单栏升为 2 栏预设", () => {
    expect(resolveColumns(one, "wide")).toEqual(COLUMN_PRESETS[2]);
    expect(resolveColumns(two, "wide")).toEqual(two);
    expect(resolveColumns(DEFAULT_COLUMNS, "wide")).toEqual(DEFAULT_COLUMNS);
    expect(resolveColumns(four, "wide")).toEqual(four);
  });
});
