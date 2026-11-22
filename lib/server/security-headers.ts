/**
 * Response headers that limit what a page may load and who may frame it (issue #18).
 * Imported by next.config.ts, so it must not depend on anything request-time.
 */

type Options = { supabaseUrl: string | undefined; dev: boolean };

/**
 * The full Content-Security-Policy. Sent report-only for now: it cannot be tried here
 * against real YouTube playback and Supabase Realtime, so violations are reported to
 * /api/csp-report (and Vercel's logs) instead of blocked. Once the logs are clean, send it
 * as Content-Security-Policy instead.
 *
 * 'unsafe-inline' is allowed for scripts and styles: Next's own bootstrap is inline, the
 * host screen injects a style tag, and nonces would force every page to render per request
 * (see the "Without Nonces" section of Next's CSP guide).
 */
export function contentSecurityPolicy({ supabaseUrl, dev }: Options): string {
  const supabase = supabaseUrl ? ` ${supabaseUrl} ${supabaseUrl.replace(/^http/, "ws")}` : "";
  return [
    "default-src 'self'",
    // YouTube's IFrame API script loads its player script from the same host.
    `script-src 'self' 'unsafe-inline' https://www.youtube.com${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Thumbnails come from YouTube; the QR code is a data URL.
    "img-src 'self' data: blob: https://i.ytimg.com",
    "font-src 'self'",
    "frame-src https://www.youtube.com",
    `connect-src 'self'${supabase}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
  ].join("; ");
}

/** Every header next.config.ts sends with every response. */
export function securityHeaders(options: Options) {
  return [
    // Enforced now: no other site may frame the app. Two headers for old and new browsers.
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    // Must keep sending the origin: YouTube's embedded player will not play without a referrer.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // Features the app never uses. Fullscreen, autoplay, vibration and the wake lock are deliberately not listed.
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ];
}

const MAX_LOGGED_LENGTH = 200;

/** Keeps the path or origin+path of a URL: no query string, which can carry session codes. */
function trimUrl(value: unknown, keep: "path" | "url"): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return (keep === "path" ? url.pathname : `${url.origin}${url.pathname}`).slice(0, MAX_LOGGED_LENGTH);
  } catch {
    return value.slice(0, MAX_LOGGED_LENGTH); // "inline", "eval" and the like
  }
}

export type CspViolation = { page: string; directive: string; blocked: string };

/** The parts of a browser's CSP report worth logging, from either report format; null for anything else. */
export function summarizeCspReport(body: unknown): CspViolation | null {
  const classic = (body as { "csp-report"?: Record<string, unknown> } | null)?.["csp-report"];
  const modern = Array.isArray(body) ? (body[0] as { body?: Record<string, unknown> } | undefined)?.body : undefined;
  const report = classic ?? modern;
  if (!report || typeof report !== "object") return null;
  const directive = report["violated-directive"] ?? report.effectiveDirective ?? report["effective-directive"];
  if (typeof directive !== "string") return null;
  return {
    page: trimUrl(report["document-uri"] ?? report.documentURL, "path"),
    directive: directive.slice(0, MAX_LOGGED_LENGTH),
    blocked: trimUrl(report["blocked-uri"] ?? report.blockedURL, "url"),
  };
}
