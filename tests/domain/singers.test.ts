import { describe, expect, it } from "vitest";
import { normalizeSingerName, SINGER_COLOR_COUNT, SINGER_NAME_MAX_LENGTH, singerColorIndex, singerInitial } from "@/lib/domain/singers";

describe("singerColorIndex", () => {
  it("gives the same colour slot to the same name, ignoring case and spaces", () => {
    expect(singerColorIndex("Maya")).toBe(singerColorIndex("  maya "));
  });

  it("always lands on one of the colour slots", () => {
    for (const name of ["Maya", "Leo", "", "Zoë", "李"]) {
      expect(singerColorIndex(name)).toBeGreaterThanOrEqual(0);
      expect(singerColorIndex(name)).toBeLessThan(SINGER_COLOR_COUNT);
    }
  });
});

describe("singerInitial", () => {
  it("takes the first character, upper-cased", () => {
    expect(singerInitial(" maya")).toBe("M");
    expect(singerInitial("李小龍")).toBe("李");
  });

  it("falls back to a question mark", () => {
    expect(singerInitial("")).toBe("?");
  });
});

describe("normalizeSingerName", () => {
  it("trims and caps the length", () => {
    expect(normalizeSingerName("  Maya ")).toBe("Maya");
    expect(normalizeSingerName("x".repeat(100))).toHaveLength(SINGER_NAME_MAX_LENGTH);
  });

  it("is empty for a blank or non-text name", () => {
    expect(normalizeSingerName("   ")).toBe("");
    expect(normalizeSingerName(undefined)).toBe("");
    expect(normalizeSingerName(7)).toBe("");
  });
});
