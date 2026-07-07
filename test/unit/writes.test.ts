// Unit tests for the shared write gate (src/security.checkWritePolicy) and the
// named write tools (src/tools/writes.ts). Fully offline. The network is stubbed
// so no request reaches any instance and no real credential is used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkWritePolicy } from "../../src/security.js";
import { registerWriteTools } from "../../src/tools/writes.js";
import { buildConfig, type Config } from "../../src/config.js";

function cfg(over: Partial<Config> = {}): Config {
  return buildConfig({ baseUrl: "https://fake.xentral.biz", token: "dummy-token", ...over });
}

// checkWritePolicy matrix.
test("checkWritePolicy allows reads in every mode", () => {
  const c = cfg({ readonly: true });
  for (const m of ["GET", "HEAD", "OPTIONS"]) assert.equal(checkWritePolicy(m, c).ok, true);
});

test("checkWritePolicy refuses POST, PATCH, PUT when read only", () => {
  const c = cfg({ readonly: true });
  for (const m of ["POST", "PATCH", "PUT"]) {
    const r = checkWritePolicy(m, c);
    assert.equal(r.ok, false);
    assert.match(r.reason ?? "", /read only/i);
  }
});

test("checkWritePolicy allows POST, PATCH, PUT when write enabled", () => {
  const c = cfg({ readonly: false });
  for (const m of ["POST", "PATCH", "PUT"]) assert.equal(checkWritePolicy(m, c).ok, true);
});

test("checkWritePolicy gates DELETE behind the extra allow-delete opt-in", () => {
  assert.equal(checkWritePolicy("DELETE", cfg({ readonly: false, allowDelete: false })).ok, false);
  assert.equal(checkWritePolicy("DELETE", cfg({ readonly: false, allowDelete: true })).ok, true);
  assert.equal(checkWritePolicy("DELETE", cfg({ readonly: true, allowDelete: true })).ok, false);
});

// Named write tools, driven through captured handlers with a stubbed fetch.
type Handler = (args: Record<string, unknown>) => Promise<{ isError?: boolean; content: { text: string }[] }>;

class FakeServer {
  handlers = new Map<string, Handler>();
  registerTool(name: string, _def: unknown, handler: Handler): void {
    this.handlers.set(name, handler);
  }
}

function fakeServer(c: Config): FakeServer {
  const s = new FakeServer();
  registerWriteTools(s as unknown as Parameters<typeof registerWriteTools>[0], c);
  return s;
}

function okJson(): Response {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("registerWriteTools registers the twelve named write tools", () => {
  const s = fakeServer(cfg());
  const names = [...s.handlers.keys()];
  assert.equal(names.length, 12);
  assert.ok(names.includes("xentral_create_sales_order"));
  assert.ok(names.includes("xentral_set_product_stock"));
  assert.ok(names.includes("xentral_receive_goods"));
});

test("a write tool refuses under read only and never calls the network", async () => {
  const s = fakeServer(cfg({ readonly: true }));
  let fetched = false;
  const orig = globalThis.fetch;
  globalThis.fetch = (async () => {
    fetched = true;
    return okJson();
  }) as typeof fetch;
  try {
    const res = await s.handlers.get("xentral_create_sales_order")!({ data: { foo: 1 } });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /read only/i);
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = orig;
  }
});

test("a create write tool issues the correct method and path when enabled", async () => {
  const s = fakeServer(cfg({ readonly: false }));
  let seenUrl = "";
  let seenMethod = "";
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenMethod = init?.method ?? "";
    return okJson();
  }) as typeof fetch;
  try {
    const res = await s.handlers.get("xentral_create_sales_order")!({ data: { foo: 1 } });
    assert.ok(!res.isError);
    assert.equal(seenMethod, "POST");
    assert.equal(seenUrl, "https://fake.xentral.biz/api/v1/salesOrders/actions/import");
  } finally {
    globalThis.fetch = orig;
  }
});

test("an id write tool substitutes the id into the path", async () => {
  const s = fakeServer(cfg({ readonly: false }));
  let seenUrl = "";
  let seenMethod = "";
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenMethod = init?.method ?? "";
    return okJson();
  }) as typeof fetch;
  try {
    await s.handlers.get("xentral_receive_goods")!({ id: "PO-42", data: {} });
    assert.equal(seenMethod, "POST");
    assert.equal(seenUrl, "https://fake.xentral.biz/api/v1/purchaseOrders/PO-42/goodsReceipts");
  } finally {
    globalThis.fetch = orig;
  }
});

test("set product stock uses PATCH on the storage location set-total-stock path", async () => {
  const s = fakeServer(cfg({ readonly: false }));
  let seenUrl = "";
  let seenMethod = "";
  const orig = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    seenUrl = String(url);
    seenMethod = init?.method ?? "";
    return okJson();
  }) as typeof fetch;
  try {
    await s.handlers.get("xentral_set_product_stock")!({ data: { total: 5 } });
    assert.equal(seenMethod, "PATCH");
    assert.equal(seenUrl, "https://fake.xentral.biz/api/v1/storageLocations/setTotalStock");
  } finally {
    globalThis.fetch = orig;
  }
});
