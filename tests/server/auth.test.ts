import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string, _options?: object) => void jar.set(name, value));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set,
  }),
}));

const { createHostToken, getHostedSessionCodes, getHostTokenHash, getOrCreateGuestId, hashHostToken, setHostCookie } = await import("@/lib/server/auth");

beforeEach(() => {
  jar.clear();
  set.mockClear();
});

describe("host tokens", () => {
  it("are long, random and stored only as a hash", () => {
    const token = createHostToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(createHostToken()).not.toBe(token);
    expect(hashHostToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashHostToken(token)).toBe(hashHostToken(token));
  });

  it("make this browser the host of the session it started, and no other", async () => {
    const token = createHostToken();
    await setHostCookie("ABC234", token);
    expect(await getHostTokenHash("ABC234")).toBe(hashHostToken(token));
    expect(await getHostTokenHash("XYZ789")).toBeNull();
    expect(await getHostedSessionCodes()).toEqual(["ABC234"]);
  });

  it("are kept out of reach of page scripts", async () => {
    await setHostCookie("ABC234", "token");
    expect(set.mock.calls[0][2]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
  });
});

describe("getOrCreateGuestId", () => {
  it("creates an id once and reuses it", async () => {
    const id = await getOrCreateGuestId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await getOrCreateGuestId()).toBe(id);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("replaces a cookie that is not an id", async () => {
    jar.set("kg", "<script>");
    expect(await getOrCreateGuestId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
