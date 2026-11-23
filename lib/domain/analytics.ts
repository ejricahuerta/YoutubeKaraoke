/**
 * What page-view analytics may see of a URL (docs/adr/0027). A session code is the key to a
 * session: anyone holding it can join and add songs, so it never leaves the app in a URL.
 */

/** Pages whose next path segment is a session code. */
const PAGES_WITH_A_CODE = ["s", "join"];

/**
 * The URL with any session code replaced by "[code]" and the query string and hash dropped
 * (the start page's "enter a code" form sends the code as ?code=). Null if it is not a URL,
 * so the page view is not sent at all.
 */
export function anonymizeAnalyticsUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/");
  // segments[0] is the empty string before the leading slash.
  const path = PAGES_WITH_A_CODE.includes(segments[1]) && segments.length > 2 ? `/${segments[1]}/[code]` : url.pathname;
  return `${url.origin}${path}`;
}
