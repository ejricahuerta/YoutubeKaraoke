/**
 * True when the request comes from a phone. Phones only ever get the
 * "add songs" view; the main screen is for TVs, laptops and tablets.
 * Tablets (iPad, Android tablets) do not send "Mobi" and count as big screens.
 */
export function isPhone(headers: { get(name: string): string | null }): boolean {
  if (headers.get("sec-ch-ua-mobile") === "?1") return true;
  const ua = headers.get("user-agent") ?? "";
  return /Mobi|iPhone|iPod|Windows Phone/i.test(ua) && !/iPad/i.test(ua);
}
