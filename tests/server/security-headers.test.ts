import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/lib/server/security-headers";

const directive = (policy: string, name: string) =>
  policy.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name} `)) ?? "";

describe("contentSecurityPolicy", () => {
  const policy = contentSecurityPolicy({ supabaseUrl: "https://abc.supabase.co", dev: false });

  it("allows YouTube's player script, its frame and its thumbnails", () => {
    expect(directive(policy, "script-src")).toContain("https://www.youtube.com");
    expect(directive(policy, "frame-src")).toContain("https://www.youtube-nocookie.com");
    expect(directive(policy, "img-src")).toContain("https://i.ytimg.com");
  });

  it("frames only YouTube's privacy-enhanced player, so a regular youtube.com embed is reported", () => {
    expect(directive(policy, "frame-src")).toBe("frame-src https://www.youtube-nocookie.com");
  });

  it("allows the QR code, which is a data URL", () => {
    expect(directive(policy, "img-src")).toContain("data:");
  });

  it("allows the Supabase project over https and, for Realtime, wss", () => {
    expect(directive(policy, "connect-src")).toBe("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
  });

  it("allows a local Supabase over http and ws", () => {
    expect(directive(contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321", dev: true }), "connect-src")).toBe(
      "connect-src 'self' http://127.0.0.1:54321 ws://127.0.0.1:54321",
    );
  });

  it("allows nothing else to connect when Supabase is not configured", () => {
    expect(directive(contentSecurityPolicy({ supabaseUrl: undefined, dev: false }), "connect-src")).toBe("connect-src 'self'");
  });

  it("refuses plugins, foreign forms and being framed, and reports what it would block", () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("report-uri /api/csp-report");
  });

  it("allows eval only in development, where React needs it", () => {
    expect(directive(policy, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ supabaseUrl: undefined, dev: true }), "script-src")).toContain("'unsafe-eval'");
  });

  it("is one line", () => {
    expect(policy).not.toMatch(/\n/);
  });
});

describe("securityHeaders", () => {
  it("enforces framing and sniffing rules, and only reports the full policy", () => {
    const headers = Object.fromEntries(securityHeaders({ supabaseUrl: "https://abc.supabase.co", dev: false }).map((h) => [h.key, h.value]));
    expect(headers["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
    expect(headers["Content-Security-Policy-Report-Only"]).toContain("connect-src 'self' https://abc.supabase.co");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });
});
