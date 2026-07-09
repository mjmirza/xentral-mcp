// Unit tests for src/setup/validate.ts. The messages are shared by the CLI and
// the hosted consent page, so they must stay context-free: no "probe" jargon and
// no CLI-only instructions like "run doctor" that make no sense on a web page.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateToken } from "../../src/setup/validate.js";

function stubFetch(handler: () => Response | Promise<Response>): { restore: () => void } {
  const original = globalThis.fetch;
  // @ts-expect-error test override
  globalThis.fetch = async () => handler();
  return { restore: () => { globalThis.fetch = original; } };
}

const HOST = "https://acme.xentral.biz";

test("a 200 is valid", async () => {
  const { restore } = stubFetch(() => new Response("{}", { status: 200 }));
  try {
    const r = await validateToken(HOST, "tok");
    assert.equal(r.outcome, "valid");
    assert.equal(r.status, 200);
  } finally { restore(); }
});

test("a 401 is unauthorized with a clear, jargon-free message", async () => {
  const { restore } = stubFetch(() => new Response("", { status: 401 }));
  try {
    const r = await validateToken(HOST, "bad");
    assert.equal(r.outcome, "unauthorized");
    assert.match(r.message, /rejected \(401\)/);
    assert.ok(!/probe/i.test(r.message), "no probe jargon");
  } finally { restore(); }
});

test("no message leaks CLI-only wording (doctor, saved config) or 'probe'", async () => {
  const statuses = [200, 404, 401, 403, 500];
  for (const s of statuses) {
    const { restore } = stubFetch(() => new Response("", { status: s }));
    try {
      const r = await validateToken(HOST, "tok");
      assert.ok(!/probe/i.test(r.message), `status ${s}: no 'probe' in "${r.message}"`);
      assert.ok(!/doctor/i.test(r.message), `status ${s}: no 'doctor' in "${r.message}"`);
      assert.ok(!/saved the config/i.test(r.message), `status ${s}: no CLI 'saved config' in "${r.message}"`);
    } finally { restore(); }
  }
});

test("a network failure is offline with a neutral message, no CLI instructions", async () => {
  const { restore } = stubFetch(() => { throw new Error("getaddrinfo ENOTFOUND"); });
  try {
    const r = await validateToken(HOST, "tok");
    assert.equal(r.outcome, "offline");
    assert.match(r.message, /Could not reach the instance/);
    assert.ok(!/doctor|saved the config/i.test(r.message));
  } finally { restore(); }
});
