import { describe, expect, it } from "vitest";
import { normalizeSessionCode, SESSION_CODE_ALPHABET, SESSION_CODE_LENGTH } from "@/lib/domain/session-code";

describe("normalizeSessionCode", () => {
  it("upper-cases and trims a valid code", () => {
    expect(normalizeSessionCode(" abc234 ")).toBe("ABC234");
  });

  it("rejects the wrong length", () => {
    expect(normalizeSessionCode("ABC23")).toBeNull();
    expect(normalizeSessionCode("ABC2345")).toBeNull();
  });

  it("rejects characters left out because they look alike on a TV", () => {
    for (const ch of "01OIL") expect(SESSION_CODE_ALPHABET).not.toContain(ch);
    expect(normalizeSessionCode("ABC10O")).toBeNull();
  });

  it("rejects path tricks and missing input", () => {
    expect(normalizeSessionCode("../../x")).toBeNull();
    expect(normalizeSessionCode(null)).toBeNull();
    expect(normalizeSessionCode(undefined)).toBeNull();
  });

  it("accepts every code the alphabet can spell", () => {
    const code = SESSION_CODE_ALPHABET.slice(0, SESSION_CODE_LENGTH);
    expect(normalizeSessionCode(code)).toBe(code);
  });
});
