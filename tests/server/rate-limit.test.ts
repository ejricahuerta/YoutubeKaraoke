import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/server/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit per minute, then recovers", () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 2, 1000)).toBe(true);
    expect(checkRateLimit(key, 2, 2000)).toBe(true);
    expect(checkRateLimit(key, 2, 3000)).toBe(false);
    expect(checkRateLimit(key, 2, 62_000)).toBe(true);
  });

  it("counts each key on its own", () => {
    const a = `test:${Math.random()}`;
    const b = `test:${Math.random()}`;
    expect(checkRateLimit(a, 1, 1000)).toBe(true);
    expect(checkRateLimit(a, 1, 1001)).toBe(false);
    expect(checkRateLimit(b, 1, 1002)).toBe(true);
  });

  it("does not let refused calls extend the wait", () => {
    const key = `test:${Math.random()}`;
    expect(checkRateLimit(key, 1, 0)).toBe(true);
    expect(checkRateLimit(key, 1, 59_000)).toBe(false);
    expect(checkRateLimit(key, 1, 60_000)).toBe(true);
  });
});
