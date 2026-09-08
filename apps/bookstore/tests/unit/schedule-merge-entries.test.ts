import { describe, it, expect } from "vitest";
import { mergeEntries, localDateTime, type CalendarEntry } from "@/features/schedule/mergeEntries";
import type { StreamPlan, LiveRecord } from "@/features/schedule/api";

const plan = (date: string, startTime: string, title: string, id = title): StreamPlan => ({
  id,
  date,
  timeType: "fixed",
  startTime,
  title,
  createdAt: "",
});

const rec = (title: string, startDate: string, stopDate?: string): LiveRecord => ({
  title,
  startDate,
  stopDate,
});

describe("localDateTime", () => {
  it("无时区后缀的 ISO 串按本地时间折算", () => {
    expect(localDateTime("2026-08-12T20:00:00")).toEqual({ date: "2026-08-12", time: "20:00" });
    expect(localDateTime("2026-08-12T09:05:00")).toEqual({ date: "2026-08-12", time: "09:05" });
  });

  it("非法串返回 null", () => {
    expect(localDateTime("not-a-date")).toBeNull();
    expect(localDateTime("")).toBeNull();
  });
});

describe("mergeEntries", () => {
  it("计划与历史按 date + startTime 升序混排", () => {
    const plans = [plan("2026-08-12", "20:00", "计划晚")];
    const records = [
      rec("历史早", "2026-08-12T08:00:00"),
      rec("历史午", "2026-08-12T13:00:00"),
    ];
    const out = mergeEntries(plans, records, new Date("2026-08-20T00:00:00"));
    expect(out.map((e) => e.startTime)).toEqual(["08:00", "13:00", "20:00"]);
    expect(out.map((e) => e.kind)).toEqual(["history", "history", "plan"]);
  });

  it("历史记录跨天（stopDate 次日）仍归入开播当日", () => {
    const out = mergeEntries(
      [],
      [rec("跨天场", "2026-08-12T23:00:00", "2026-08-13T01:00:00")],
      new Date("2026-08-20T00:00:00"),
    );
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe("history");
    expect(out[0].date).toBe("2026-08-12");
    expect((out[0] as Extract<CalendarEntry, { kind: "history" }>).endTime).toBe("01:00");
  });

  it("缺 title 或 startDate 的历史记录丢弃", () => {
    const out = mergeEntries(
      [],
      [
        rec("", "2026-08-12T20:00:00"),
        { title: "缺start", startDate: "" } as LiveRecord,
        rec("正常", "2026-08-12T20:00:00"),
      ],
      new Date("2026-08-20T00:00:00"),
    );
    expect(out.map((e) => (e.kind === "history" ? e.record.title : e.plan.title))).toEqual(["正常"]);
  });

  it("非法 startDate 丢弃", () => {
    const out = mergeEntries([], [rec("坏日期", "invalid")], new Date("2026-08-20T00:00:00"));
    expect(out).toEqual([]);
  });

  it("now 之后（未来）的历史记录不纳入", () => {
    const now = new Date("2026-08-15T12:00:00");
    const out = mergeEntries(
      [],
      [rec("已播", "2026-08-15T08:00:00"), rec("未播", "2026-08-15T20:00:00")],
      now,
    );
    expect(out.map((e) => (e.kind === "history" ? e.record.title : ""))).toEqual(["已播"]);
  });

  it("同日同时计划与历史都保留不去重", () => {
    const out = mergeEntries(
      [plan("2026-08-12", "20:00", "计划")],
      [rec("历史", "2026-08-12T20:00:00")],
      new Date("2026-08-20T00:00:00"),
    );
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.kind)).toEqual(["plan", "history"]);
  });
});
