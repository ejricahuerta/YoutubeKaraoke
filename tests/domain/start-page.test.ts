import { describe, expect, it } from "vitest";
import { goodForSentence, HEADLINE_OPENERS, listInWords, OCCASIONS } from "@/lib/domain/start-page";

describe("the start page's rolling words", () => {
  it("opens the headline with the question the pun answers, which is also what screen readers hear", () => {
    expect(HEADLINE_OPENERS[0]).toBe("Not okay?");
    expect(new Set(HEADLINE_OPENERS).size).toBe(HEADLINE_OPENERS.length);
  });

  it("names every occasion in one steady sentence for screen readers", () => {
    expect(goodForSentence()).toBe(`Great for ${listInWords(OCCASIONS)}.`);
    for (const occasion of OCCASIONS) expect(goodForSentence()).toContain(occasion);
  });
});

describe("listInWords", () => {
  it("joins a list the way people say it", () => {
    expect(listInWords([])).toBe("");
    expect(listInWords(["birthdays"])).toBe("birthdays");
    expect(listInWords(["birthdays", "game night"])).toBe("birthdays and game night");
    expect(listInWords(["birthdays", "game night", "the office party"])).toBe("birthdays, game night and the office party");
  });
});
