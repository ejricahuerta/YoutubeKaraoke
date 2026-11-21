// No 0/O, 1/I/L: codes get read off a TV and typed on a phone.
export const SESSION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const SESSION_CODE_LENGTH = 6;

/** Upper-cases and validates a session code; returns null if it cannot be one. */
export function normalizeSessionCode(input: string | null | undefined): string | null {
  const code = (input ?? "").trim().toUpperCase();
  if (code.length !== SESSION_CODE_LENGTH) return null;
  for (const ch of code) {
    if (!SESSION_CODE_ALPHABET.includes(ch)) return null;
  }
  return code;
}
