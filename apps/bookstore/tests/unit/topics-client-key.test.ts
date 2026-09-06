// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getClientKey } from "../../features/topics/clientKey";

describe("getClientKey", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("returns a UUID on first call", () => {
    const key = getClientKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("returns the same key on subsequent calls", () => {
    const key1 = getClientKey();
    const key2 = getClientKey();
    expect(key1).toBe(key2);
  });

  it("returns a new key if stored value is invalid", () => {
    window.localStorage.setItem("topics.clientKey", "invalid-key");
    const key = getClientKey();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(key).not.toBe("invalid-key");
  });
});
