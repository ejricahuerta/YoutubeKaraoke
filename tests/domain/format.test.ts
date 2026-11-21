import { describe, expect, it } from "vitest";
import { countSongs, formatDuration, formatWait, ordinal } from "@/lib/domain/format";

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3725)).toBe("1:02:05");
  });

  it("is empty when the length is unknown", () => {
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(-3)).toBe("");
    expect(formatDuration(Number.NaN)).toBe("");
  });
});

describe("formatWait", () => {
  it("words waits the way people say them", () => {
    expect(formatWait(30)).toBe("any minute now");
    expect(formatWait(14 * 60)).toBe("about 14 min");
    expect(formatWait(60 * 60)).toBe("about 1 hr");
    expect(formatWait(75 * 60)).toBe("about 1 hr 15 min");
  });
});

describe("ordinal", () => {
  it("handles the teens and the rest", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual(
      ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st", "111th"],
    );
  });
});

describe("countSongs", () => {
  it("pluralizes", () => {
    expect(countSongs(0)).toBe("0 songs");
    expect(countSongs(1)).toBe("1 song");
    expect(countSongs(2)).toBe("2 songs");
  });
});
