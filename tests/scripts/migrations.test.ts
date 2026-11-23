import { describe, expect, it } from "vitest";
import { deployPlan, historyName, historyVersion, pendingMigrations } from "@/scripts/migrations.mts";

describe("historyName", () => {
  it("names a file karaoke_<file name without number>, like the entries already in production", () => {
    expect(historyName("0001_init.sql")).toBe("karaoke_init");
    expect(historyName("0010_first_guest_is_the_remote.sql")).toBe("karaoke_first_guest_is_the_remote");
  });

  it("rejects a file that does not follow NNNN_name.sql", () => {
    expect(() => historyName("init.sql")).toThrow(/NNNN_name\.sql/);
    expect(() => historyName("0011_Bad-Name.sql")).toThrow(/NNNN_name\.sql/);
  });
});

describe("pendingMigrations", () => {
  it("returns the .sql files not yet in the history, in file-name order", () => {
    const files = ["0003_c.sql", "README.md", "0001_a.sql", "0002_b.sql"];
    expect(pendingMigrations(files, ["karaoke_a"])).toEqual(["0002_b.sql", "0003_c.sql"]);
  });

  it("returns nothing when every file is applied", () => {
    expect(pendingMigrations(["0001_a.sql"], ["karaoke_a", "other_app_thing"])).toEqual([]);
  });

  it("refuses two files that would share a history name", () => {
    expect(() => pendingMigrations(["0001_a.sql", "0002_a.sql"], [])).toThrow(/karaoke_a/);
  });
});

describe("historyVersion", () => {
  it("is a UTC timestamp like Supabase's own, one second apart per migration in a run", () => {
    const at = new Date("2026-11-22T04:30:05Z");
    expect(historyVersion(at, 0)).toBe("20261122043005");
    expect(historyVersion(at, 1)).toBe("20261122043006");
  });
});

describe("deployPlan", () => {
  const url = "postgres://user@db.example/postgres";

  it("skips outside Vercel, so CI and local builds never touch a database", () => {
    expect(deployPlan({})).toEqual({ run: false, reason: expect.stringMatching(/not a Vercel production build/) });
  });

  it("skips preview builds, even when a database URL is visible to them", () => {
    expect(deployPlan({ VERCEL_ENV: "preview", DATABASE_URL: url })).toMatchObject({ run: false });
  });

  const secrets = { SESSION_SECRET: "s".repeat(48), SUPABASE_SECRET_KEY: "sb_secret_x" };

  it("migrates a production build", () => {
    expect(deployPlan({ VERCEL_ENV: "production", DATABASE_URL: url, ...secrets })).toEqual({ run: true, databaseUrl: url });
  });

  it("fails a production build without DATABASE_URL rather than ship code ahead of its database", () => {
    expect(() => deployPlan({ VERCEL_ENV: "production", ...secrets })).toThrow(/DATABASE_URL/);
  });

  it("fails a production build without the secrets that sign cookies and start sessions, before migrating", () => {
    expect(() => deployPlan({ VERCEL_ENV: "production", DATABASE_URL: url, SUPABASE_SECRET_KEY: "k" })).toThrow(/SESSION_SECRET/);
    expect(() => deployPlan({ VERCEL_ENV: "production", DATABASE_URL: url, SESSION_SECRET: "short", SUPABASE_SECRET_KEY: "k" })).toThrow(/SESSION_SECRET/);
    expect(() => deployPlan({ VERCEL_ENV: "production", DATABASE_URL: url, SESSION_SECRET: "s".repeat(48) })).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
