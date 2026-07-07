// Unit tests for src/http.ts (request building and error mapping).
import { test } from "node:test";
import assert from "node:assert/strict";
import { xentralRequest, requestWithRateLimitRetry } from "../../src/http.js";
import { XentralApiError } from "../../src/errors.js";
import type { Config } from "../../src/config.js";

const cfg: Config = {
  baseUrl: "https://acme.xentral.biz",
  token: "tok-secret-123",
  timeoutMs: 30000,
  maxResponseChars: 20000,
  readonly: false,
  allowDelete: true,
};

interface Capture {
  url: string;
  init: RequestInit & { headers: Record<string, string> };
}

// Install a fetch stub that records the call and returns the given response.
// Returns the capture holder plus a restore function.
function stubFetch(makeResponse: () => Response) {
  const capture = { url: "", init: {} as Capture["init"] };
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: unknown) => {
    capture.url = String(input);
    capture.init = (init ?? {}) as Capture["init"];
    return makeResponse();
  }) as typeof fetch;
  const restore = () => {
    globalThis.fetch = original;
  };
  return { capture, restore };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("builds an absolute URL from the host base and path", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, { method: "GET", path: "/api/v2/products" });
    assert.equal(capture.url, "https://acme.xentral.biz/api/v2/products");
  } finally {
    restore();
  }
});

test("percent encodes bracket query keys", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, {
      method: "GET",
      path: "/api/v2/products",
      query: { "page[size]": 10, "page[number]": 2 },
    });
    assert.match(capture.url, /page%5Bsize%5D=10/);
    assert.match(capture.url, /page%5Bnumber%5D=2/);
  } finally {
    restore();
  }
});

test("skips undefined, null and empty query values", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, {
      method: "GET",
      path: "/api/v2/products",
      query: { a: "keep", b: undefined, c: null, d: "" },
    });
    assert.match(capture.url, /a=keep/);
    assert.ok(!capture.url.includes("b="));
    assert.ok(!capture.url.includes("c="));
    assert.ok(!capture.url.includes("d="));
  } finally {
    restore();
  }
});

test("no query yields a bare path with no question mark", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, { method: "GET", path: "/api/v2/products" });
    assert.ok(!capture.url.includes("?"));
  } finally {
    restore();
  }
});

test("attaches the Bearer Authorization header and a JSON Accept", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, { method: "GET", path: "/api/v2/products" });
    assert.equal(capture.init.headers.Authorization, "Bearer tok-secret-123");
    assert.equal(capture.init.headers.Accept, "application/json");
  } finally {
    restore();
  }
});

test("refuses redirects", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, { method: "GET", path: "/api/v2/products" });
    // "manual" refuses to follow a redirect (a 3xx becomes a non 2xx the layer
    // rejects), and unlike "error" it is accepted by the Cloudflare workerd
    // runtime, so the same value works under Node and the Worker.
    assert.equal(capture.init.redirect, "manual");
  } finally {
    restore();
  }
});

test("requestWithRateLimitRetry retries once after a 429 and then succeeds", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls += 1;
    return calls === 1 ? jsonResponse({ error: "rate limited" }, 429) : jsonResponse({ ok: true }, 200);
  }) as typeof fetch;
  try {
    const res = await requestWithRateLimitRetry(cfg, { method: "GET", path: "/api/v2/products" });
    assert.equal(calls, 2);
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, { ok: true });
  } finally {
    globalThis.fetch = original;
  }
});

test("requestWithRateLimitRetry rethrows a non-429 error without retrying", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ error: "boom" }, 500);
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => requestWithRateLimitRetry(cfg, { method: "GET", path: "/api/v2/products" }),
      (err: unknown) => err instanceof XentralApiError && err.status === 500,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test("a POST serializes the JSON body and sets content type", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ created: true }, 201));
  try {
    await xentralRequest(cfg, {
      method: "POST",
      path: "/api/v2/orders",
      body: { sku: "ABC", qty: 3 },
    });
    assert.equal(capture.init.method, "POST");
    assert.equal(capture.init.headers["Content-Type"], "application/json");
    assert.equal(capture.init.body, JSON.stringify({ sku: "ABC", qty: 3 }));
  } finally {
    restore();
  }
});

test("a string body is passed through without re serializing", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, {
      method: "POST",
      path: "/api/v2/raw",
      body: "already-a-string",
    });
    assert.equal(capture.init.body, "already-a-string");
  } finally {
    restore();
  }
});

test("a caller Accept header override is passed through", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, {
      method: "GET",
      path: "/api/v2/products",
      headers: { Accept: "text/csv" },
    });
    assert.equal(capture.init.headers.Accept, "text/csv");
  } finally {
    restore();
  }
});

test("a caller Content-Type override is not clobbered on a body request", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, {
      method: "PUT",
      path: "/api/v2/x",
      body: "raw",
      headers: { "Content-Type": "text/plain" },
    });
    assert.equal(capture.init.headers["Content-Type"], "text/plain");
  } finally {
    restore();
  }
});

test("a passed X-Pagination header reaches fetch", async () => {
  const { capture, restore } = stubFetch(() => jsonResponse({ ok: true }));
  try {
    await xentralRequest(cfg, {
      method: "GET",
      path: "/api/v3/products",
      headers: { "X-Pagination": "cursor" },
    });
    assert.equal(capture.init.headers["X-Pagination"], "cursor");
  } finally {
    restore();
  }
});

test("parses a JSON response into data", async () => {
  const { restore } = stubFetch(() => jsonResponse({ data: [{ id: 1 }] }));
  try {
    const res = await xentralRequest(cfg, { method: "GET", path: "/api/v2/products" });
    assert.equal(res.status, 200);
    assert.deepEqual(res.data, { data: [{ id: 1 }] });
  } finally {
    restore();
  }
});

test("echoes the x-pagination response header", async () => {
  const { restore } = stubFetch(() =>
    jsonResponse({ data: [] }, 200, { "x-pagination": "next=abc" }),
  );
  try {
    const res = await xentralRequest(cfg, { method: "GET", path: "/api/v3/products" });
    assert.equal(res.paginationHeader, "next=abc");
  } finally {
    restore();
  }
});

test("returns the raw text when the response is not JSON", async () => {
  const { restore } = stubFetch(
    () => new Response("plain text", { status: 200, headers: { "content-type": "text/plain" } }),
  );
  try {
    const res = await xentralRequest(cfg, { method: "GET", path: "/api/v2/x" });
    assert.equal(res.data, "plain text");
  } finally {
    restore();
  }
});

test("a non 2xx response throws XentralApiError carrying the status", async () => {
  const { restore } = stubFetch(() => jsonResponse({ error: "nope" }, 422));
  try {
    await assert.rejects(
      () => xentralRequest(cfg, { method: "POST", path: "/api/v2/orders", body: {} }),
      (err: unknown) => {
        assert.ok(err instanceof XentralApiError);
        assert.equal(err.status, 422);
        assert.equal(err.path, "/api/v2/orders");
        assert.equal(err.method, "POST");
        return true;
      },
    );
  } finally {
    restore();
  }
});

test("a 500 error body has the token redacted", async () => {
  const { restore } = stubFetch(() =>
    new Response(JSON.stringify({ leaked: "tok-secret-123" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    }),
  );
  try {
    await assert.rejects(
      () => xentralRequest(cfg, { method: "GET", path: "/api/v2/x" }),
      (err: unknown) => {
        assert.ok(err instanceof XentralApiError);
        assert.ok(!err.body.includes("tok-secret-123"));
        assert.match(err.body, /\[REDACTED\]/);
        return true;
      },
    );
  } finally {
    restore();
  }
});

test("a network error is wrapped as XentralApiError with status 0", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("connection refused");
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => xentralRequest(cfg, { method: "GET", path: "/api/v2/x" }),
      (err: unknown) => {
        assert.ok(err instanceof XentralApiError);
        assert.equal(err.status, 0);
        assert.match(err.message, /Network error/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("a timeout is wrapped with a clear timeout message", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    const e = new Error("timed out");
    e.name = "TimeoutError";
    throw e;
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => xentralRequest(cfg, { method: "GET", path: "/api/v2/x" }),
      (err: unknown) => {
        assert.ok(err instanceof XentralApiError);
        assert.equal(err.status, 0);
        assert.match(err.message, /timed out after 30000ms/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("an empty JSON body response falls back to the raw text", async () => {
  const { restore } = stubFetch(
    () => new Response("", { status: 200, headers: { "content-type": "application/json" } }),
  );
  try {
    const res = await xentralRequest(cfg, { method: "GET", path: "/api/v2/x" });
    assert.equal(res.data, "");
  } finally {
    restore();
  }
});

test("malformed JSON in a 200 body is returned as the raw text", async () => {
  const { restore } = stubFetch(
    () => new Response("{not json", { status: 200, headers: { "content-type": "application/json" } }),
  );
  try {
    const res = await xentralRequest(cfg, { method: "GET", path: "/api/v2/x" });
    assert.equal(res.data, "{not json");
  } finally {
    restore();
  }
});
