import { afterEach, describe, expect, it, vi } from "vitest";
import { summarizeCspReport } from "@/lib/server/security-headers";

const { POST } = await import("@/app/api/csp-report/route");

describe("summarizeCspReport", () => {
  it("reads the classic report-uri format", () => {
    expect(summarizeCspReport({
      "csp-report": { "document-uri": "https://karaoke.edmel.dev/s/ABC234?x=1", "violated-directive": "script-src-elem", "blocked-uri": "https://evil.example/x.js" },
    })).toEqual({ page: "/s/ABC234", directive: "script-src-elem", blocked: "https://evil.example/x.js" });
  });

  it("reads the Reporting API format", () => {
    expect(summarizeCspReport([
      { type: "csp-violation", body: { documentURL: "https://karaoke.edmel.dev/join/ABC234", effectiveDirective: "frame-src", blockedURL: "https://www.youtube-nocookie.com/embed/x" } },
    ])).toEqual({ page: "/join/ABC234", directive: "frame-src", blocked: "https://www.youtube-nocookie.com/embed/x" });
  });

  it("drops query strings and cuts long values, so logs hold no codes from URLs and stay short", () => {
    const summary = summarizeCspReport({ "csp-report": { "document-uri": "https://x/s/ABC234", "violated-directive": "img-src", "blocked-uri": `https://i.ytimg.com/vi/a.jpg?${"q".repeat(500)}` } });
    expect(summary?.blocked).toBe("https://i.ytimg.com/vi/a.jpg");
  });

  it("ignores anything that is not a report", () => {
    expect(summarizeCspReport(null)).toBeNull();
    expect(summarizeCspReport({ hello: "world" })).toBeNull();
    expect(summarizeCspReport("text")).toBeNull();
  });
});

describe("POST /api/csp-report", () => {
  afterEach(() => vi.restoreAllMocks());
  const post = (body: string, ip: string) =>
    new Request("http://localhost/api/csp-report", { method: "POST", body, headers: { "content-type": "application/csp-report", "x-forwarded-for": ip } });

  it("logs one line per report and answers 204", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await POST(post(JSON.stringify({ "csp-report": { "document-uri": "https://x/", "violated-directive": "img-src", "blocked-uri": "https://y/z.png" } }), "203.0.113.50"));
    expect(res.status).toBe(204);
    expect(log).toHaveBeenCalledWith("CSP report-only violation", { page: "/", directive: "img-src", blocked: "https://y/z.png" });
  });

  it("answers 204 without logging junk", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await POST(post("not json", "203.0.113.51"))).status).toBe(204);
    expect(log).not.toHaveBeenCalled();
  });

  it("stops logging a caller that floods it", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    const report = JSON.stringify({ "csp-report": { "document-uri": "https://x/", "violated-directive": "img-src", "blocked-uri": "https://y/z.png" } });
    for (let i = 0; i < 100; i++) await POST(post(report, "203.0.113.52"));
    expect(log.mock.calls.length).toBeLessThan(100);
  });
});
