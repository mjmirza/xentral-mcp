// Unit tests for src/errors.ts (error shape and secret redaction).
import { test } from "node:test";
import assert from "node:assert/strict";
import { XentralApiError, redactSecrets } from "../../src/errors.js";

test("XentralApiError carries the status, path, method and body", () => {
  const err = new XentralApiError({
    status: 404,
    path: "/api/v2/products",
    method: "GET",
    body: "not found",
  });
  assert.equal(err.status, 404);
  assert.equal(err.path, "/api/v2/products");
  assert.equal(err.method, "GET");
  assert.equal(err.body, "not found");
  assert.equal(err.name, "XentralApiError");
  assert.ok(err instanceof Error);
});

test("XentralApiError message includes the summary and the body", () => {
  const err = new XentralApiError({
    status: 500,
    path: "/api/v2/orders",
    method: "POST",
    body: "boom",
  });
  assert.match(err.message, /Xentral API POST \/api\/v2\/orders failed with 500/);
  assert.match(err.message, /boom/);
});

test("XentralApiError message omits the body when there is none", () => {
  const err = new XentralApiError({ status: 401, path: "/api/x", method: "GET" });
  assert.equal(err.message, "Xentral API GET /api/x failed with 401");
  assert.equal(err.body, "");
});

// redactSecrets.
test("redactSecrets removes the configured token value", () => {
  const token = "supersecrettoken123";
  const out = redactSecrets(`the token is ${token} ok`, token);
  assert.ok(!out.includes(token));
  assert.match(out, /\[REDACTED\]/);
});

test("redactSecrets removes every occurrence of the token", () => {
  const token = "abc123def";
  const out = redactSecrets(`${token} then ${token} again`, token);
  assert.ok(!out.includes(token));
  assert.equal(out, "[REDACTED] then [REDACTED] again");
});

test("redactSecrets masks a Bearer token pattern", () => {
  const out = redactSecrets("Authorization: Bearer eyJhbGci.foo-bar_123", "othertoken");
  assert.match(out, /Bearer \[REDACTED\]/);
  assert.ok(!out.includes("eyJhbGci.foo-bar_123"));
});

test("redactSecrets leaves a message with no secret unchanged", () => {
  const msg = "a plain error with nothing sensitive";
  assert.equal(redactSecrets(msg, "sometoken123"), msg);
});

test("redactSecrets ignores a very short token to avoid false hits", () => {
  // Guard only splits on a token of length 6 or more.
  const out = redactSecrets("the letter a appears", "a");
  assert.equal(out, "the letter a appears");
});

test("redactSecrets handles an empty token safely", () => {
  const msg = "no secret here";
  assert.equal(redactSecrets(msg, ""), msg);
});

test("redactSecrets handles an empty message", () => {
  assert.equal(redactSecrets("", "sometoken123"), "");
});

test("redactSecrets is idempotent when run twice", () => {
  const token = "repeatabletoken";
  const once = redactSecrets(`x ${token} y`, token);
  const twice = redactSecrets(once, token);
  assert.equal(twice, once);
});

test("redactSecrets handles a unicode message and token", () => {
  const token = "tokén-über-99";
  const out = redactSecrets(`grüße ${token} ende`, token);
  assert.ok(!out.includes(token));
  assert.match(out, /grüße \[REDACTED\] ende/);
});
