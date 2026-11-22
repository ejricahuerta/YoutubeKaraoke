import { afterEach, describe, expect, it, vi } from "vitest";
import { clientIp, errorResponse, readJsonBody, resultResponse, sessionRoute } from "@/lib/server/api";

const headers = (values: Record<string, string>) => new Headers(values);

describe("resultResponse", () => {
  it("answers 200 for results that are not errors", async () => {
    for (const result of ["ok", "stale"] as const) {
      const res = resultResponse(result);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, result });
    }
  });

  it("maps each refusal to its HTTP status", async () => {
    const cases = { not_found: 404, forbidden: 403, invalid: 400, queue_full: 409, guest_limit: 409, archived: 410 } as const;
    for (const [error, status] of Object.entries(cases)) {
      const res = resultResponse(error as keyof typeof cases);
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error });
    }
  });

  it("treats an answer it does not know as a server error", () => {
    expect(resultResponse("surprise" as never).status).toBe(500);
  });
});

describe("errorResponse", () => {
  it("uses the same body shape as a refused mutation", async () => {
    const res = errorResponse("rate_limited", 429);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: "rate_limited" });
  });
});

describe("readJsonBody", () => {
  const post = (body: string) => new Request("http://x/", { method: "POST", body });

  it("returns the parsed object", async () => {
    expect(await readJsonBody(post('{"a":1}'))).toEqual({ a: 1 });
  });

  it("returns an empty object for anything that is not a JSON object", async () => {
    expect(await readJsonBody(post("not json"))).toEqual({});
    expect(await readJsonBody(post("null"))).toEqual({});
    expect(await readJsonBody(post('"text"'))).toEqual({});
  });
});

describe("clientIp", () => {
  it("takes the first address of x-forwarded-for", () => {
    expect(clientIp(headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to one shared bucket when there is no proxy header", () => {
    expect(clientIp(headers({}))).toBe("local");
    expect(clientIp(headers({ "x-forwarded-for": " " }))).toBe("local");
  });
});

describe("sessionRoute", () => {
  afterEach(() => vi.restoreAllMocks());
  const request = new Request("http://x/");
  const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });

  it("hands the handler a normalized session code and the route params", async () => {
    const handler = vi.fn(async () => new Response("done"));
    const res = await sessionRoute<{ code: string; id: string }>(handler)(request, ctx({ code: "abc234", id: "7" }));
    expect(await res.text()).toBe("done");
    expect(handler).toHaveBeenCalledWith(request, { code: "ABC234", params: { code: "abc234", id: "7" } });
  });

  it("answers 404 without running the handler when the code cannot be one", async () => {
    const handler = vi.fn(async () => new Response("done"));
    const res = await sessionRoute(handler)(request, ctx({ code: "nope" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "not_found" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns a thrown error into a 500 that leaks nothing", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await sessionRoute(async () => {
      throw new Error("get_state failed: connection refused at db.internal");
    })(request, ctx({ code: "ABC234" }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: "server_error" });
    expect(log).toHaveBeenCalled();
  });
});
