/** Words the start page rolls through on a big screen: the headline's question and what a session is good for. */

/**
 * The headline's first words, before "Hit start. Kara-OK.". The first one sets up the pun, so it is
 * the one screen readers hear and the one that stays put for people who asked for less motion.
 */
export const HEADLINE_OPENERS = ["Not okay?", "Bad day?", "Long week?", "Can't sing?", "Shower singer?"] as const;
export const OPENER_EVERY_MS = 2800;

/** Shown one at a time after "Great for", beside "Start a session". */
export const OCCASIONS = ["birthdays", "game night", "the office party", "family get-togethers", "roommates on a Friday"] as const;
export const OCCASION_EVERY_MS = 2500;

/** "a, b and c": a list the way people say it. */
export function listInWords(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Every occasion in one sentence, for screen readers in place of the rolling one. */
export function goodForSentence(): string {
  return `Great for ${listInWords(OCCASIONS)}.`;
}
