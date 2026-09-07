import { describe, expect, it } from "vitest";
import { deriveStatus, type TopicStatus } from "../src/db/topics";

describe("deriveStatus", () => {
  const now = new Date("2026-09-06T12:00:00Z");

  it("upcoming: now < startAt", () => {
    const topic = {
      startAt: new Date("2026-09-07T00:00:00Z"),
      endAt: new Date("2026-09-08T00:00:00Z"),
      collectingStopped: false,
      archived: false,
    };
    expect(deriveStatus(topic, now)).toBe("upcoming");
  });

  it("collecting: startAt <= now <= endAt, not stopped, not archived", () => {
    const topic = {
      startAt: new Date("2026-09-05T00:00:00Z"),
      endAt: new Date("2026-09-07T00:00:00Z"),
      collectingStopped: false,
      archived: false,
    };
    expect(deriveStatus(topic, now)).toBe("collecting");
  });

  it("ended: now > endAt", () => {
    const topic = {
      startAt: new Date("2026-09-04T00:00:00Z"),
      endAt: new Date("2026-09-05T00:00:00Z"),
      collectingStopped: false,
      archived: false,
    };
    expect(deriveStatus(topic, now)).toBe("ended");
  });

  it("ended: collectingStopped = true", () => {
    const topic = {
      startAt: new Date("2026-09-05T00:00:00Z"),
      endAt: new Date("2026-09-07T00:00:00Z"),
      collectingStopped: true,
      archived: false,
    };
    expect(deriveStatus(topic, now)).toBe("ended");
  });

  it("ended: archived = true", () => {
    const topic = {
      startAt: new Date("2026-09-05T00:00:00Z"),
      endAt: new Date("2026-09-07T00:00:00Z"),
      collectingStopped: false,
      archived: true,
    };
    expect(deriveStatus(topic, now)).toBe("ended");
  });
});
