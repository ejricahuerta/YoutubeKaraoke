import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));

const { BROWSER_STORAGE, formatLifetime, LEGAL_PAGES } = await import("@/lib/domain/legal");
const { GUEST_COOKIE, GUEST_COOKIE_MAX_AGE, HOST_COOKIE_MAX_AGE, HOST_COOKIE_PREFIX } = await import("@/lib/server/auth");
const { STORAGE_KEYS } = await import("@/lib/client/browser-hooks");

describe("the cookie policy", () => {
  it("lists every cookie the server sets, with the lifetime the server gives it", () => {
    const guest = BROWSER_STORAGE.find((e) => e.name === GUEST_COOKIE);
    const host = BROWSER_STORAGE.find((e) => e.name === `${HOST_COOKIE_PREFIX}<CODE>`);
    expect(guest).toMatchObject({ kind: "cookie", lifetimeSeconds: GUEST_COOKIE_MAX_AGE });
    expect(host).toMatchObject({ kind: "cookie", lifetimeSeconds: HOST_COOKIE_MAX_AGE });
  });

  it("lists every key the app keeps in the browser's local storage, and nothing it does not", () => {
    const listed = BROWSER_STORAGE.filter((e) => e.kind === "local storage").map((e) => e.name);
    expect(listed.sort()).toEqual(Object.values(STORAGE_KEYS).sort());
  });

  it("says what every entry is for and how long it lasts", () => {
    for (const entry of BROWSER_STORAGE) {
      expect(entry.purpose, entry.name).not.toBe("");
      expect(formatLifetime(entry), entry.name).not.toBe("");
    }
  });
});

describe("lifetimes", () => {
  it("read in whole days or years", () => {
    expect(formatLifetime({ lifetimeSeconds: 60 * 60 * 24 * 30 })).toBe("30 days");
    expect(formatLifetime({ lifetimeSeconds: 60 * 60 * 24 * 365 })).toBe("1 year");
    expect(formatLifetime({ lifetimeSeconds: 60 * 60 * 24 })).toBe("1 day");
  });

  it("say when they last until the person clears them", () => {
    expect(formatLifetime({})).toBe("Until you clear your browser's site data");
  });
});

describe("legal pages", () => {
  it("are the terms, the privacy policy and the cookie policy", () => {
    expect(LEGAL_PAGES.map((p) => p.href)).toEqual(["/terms", "/privacy", "/cookies"]);
  });
});
