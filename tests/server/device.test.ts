import { describe, expect, it } from "vitest";
import { isPhone } from "@/lib/server/device";

const h = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
const ua = (value: string) => h({ "user-agent": value });

describe("isPhone", () => {
  it("detects phones", () => {
    expect(isPhone(ua("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"))).toBe(true);
    expect(isPhone(ua("Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36"))).toBe(true);
    expect(isPhone(h({ "sec-ch-ua-mobile": "?1", "user-agent": "Mozilla/5.0 (Linux; Android 10; K) Chrome/120" }))).toBe(true);
  });

  it("treats desktops, TVs and tablets as big screens", () => {
    expect(isPhone(ua("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"))).toBe(false);
    expect(isPhone(ua("Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0) AppleWebKit/537.36 Chrome/94.0 TV Safari/537.36"))).toBe(false);
    expect(isPhone(ua("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"))).toBe(false);
    expect(isPhone(ua("Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 Chrome/120.0 Safari/537.36"))).toBe(false);
    expect(isPhone(h({}))).toBe(false);
  });
});
