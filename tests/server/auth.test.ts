import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "test-secret-".padEnd(48, "x");
vi.stubEnv("SESSION_SECRET", SECRET);

const jar = new Map<string, string>();
const set = vi.fn((name: string, value: string, _options?: object) => void jar.set(name, value));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set,
    delete: (name: string) => void jar.delete(name),
  }),
}));

const { clearHostCookie, createHostToken, getHostedSessionCodes, getHostTokenHash, getOrCreateGuestId, hashHostToken, hashNetwork, setHostCookie } =
  await import("@/lib/server/auth");

beforeEach(() => {
  jar.clear();
  set.mockClear();
  vi.stubEnv("SESSION_SECRET", SECRET);
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

  it("can be dropped once the session is over", async () => {
    await setHostCookie("ABC234", "token");
    await setHostCookie("XYZ789", "token");
    await clearHostCookie("ABC234");
    expect(await getHostTokenHash("ABC234")).toBeNull();
    expect(await getHostedSessionCodes()).toEqual(["XYZ789"]);
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

  it("signs the cookie, so the id in it is one this server handed out", async () => {
    const id = await getOrCreateGuestId();
    const [value, signature] = jar.get("kg")!.split(".");
    expect(value).toBe(id);
    expect(signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("refuses an edited, forged or unsigned cookie, and hands out a new id instead", async () => {
    const id = await getOrCreateGuestId();
    const signed = jar.get("kg")!;
    const someoneElse = "3f2c1b7e-8a4d-4e6f-9b0a-1c2d3e4f5a6b";
    for (const tampered of [
      `${someoneElse}.${signed.split(".")[1]}`, // another id under this id's signature
      `${id}.${"A".repeat(43)}`, // a made-up signature
      `${id}.${signed.split(".")[1].slice(0, -1)}`, // a cut-short one
      id, // the old, unsigned cookie
      `${signed}.extra`,
    ]) {
      jar.set("kg", tampered);
      const next = await getOrCreateGuestId();
      expect(next, tampered).not.toBe(id);
      expect(next, tampered).not.toBe(someoneElse);
    }
  });

  it("does not accept a cookie signed with another secret", async () => {
    vi.stubEnv("SESSION_SECRET", "another-secret-".padEnd(48, "y"));
    const id = await getOrCreateGuestId();
    vi.stubEnv("SESSION_SECRET", SECRET);
    expect(await getOrCreateGuestId()).not.toBe(id);
  });

  it("will not run without a long enough secret", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    await expect(getOrCreateGuestId()).rejects.toThrow(/SESSION_SECRET/);
    vi.stubEnv("SESSION_SECRET", "short");
    await expect(getOrCreateGuestId()).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("hashNetwork", () => {
  it("names a network without storing its address: a keyed hash, the same for every device on it", () => {
    const hash = hashNetwork("2001:db8:1:2::1");
    expect(hash).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).not.toContain("2001");
    expect(hashNetwork("2001:db8:1:2:ffff::9")).toBe(hash);
    expect(hashNetwork("198.51.100.7")).not.toBe(hashNetwork("198.51.100.8"));
  });

  it("depends on the secret, so a stored hash cannot be matched to an address by trying them all", () => {
    const hash = hashNetwork("198.51.100.7");
    vi.stubEnv("SESSION_SECRET", "another-secret-".padEnd(48, "y"));
    expect(hashNetwork("198.51.100.7")).not.toBe(hash);
  });
});
