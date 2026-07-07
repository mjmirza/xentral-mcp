// Unit tests for the enterprise-grade host and path guards in src/security.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSafeBaseUrl, normalizePath } from "../../src/security.js";
import { redactSecrets } from "../../src/errors.js";

// assertSafeBaseUrl. the SSRF and cleartext-credential guard.
test("assertSafeBaseUrl allows a public https host", () => {
  assert.doesNotThrow(() => assertSafeBaseUrl("https://acme.xentral.biz"));
  assert.doesNotThrow(() => assertSafeBaseUrl("https://6a4cfc178e809.demo.xentral.com"));
});

test("assertSafeBaseUrl blocks cleartext http unless opted in", () => {
  assert.throws(() => assertSafeBaseUrl("http://acme.xentral.biz"), /https/i);
  assert.doesNotThrow(() => assertSafeBaseUrl("http://acme.xentral.biz", { allowInsecureHttp: true }));
});

test("assertSafeBaseUrl blocks a userinfo host-spoof", () => {
  assert.throws(() => assertSafeBaseUrl("https://acme.xentral.biz@evil.com"), /userinfo/i);
  assert.throws(() => assertSafeBaseUrl("https://user:pass@evil.com"), /userinfo/i);
});

test("assertSafeBaseUrl blocks loopback, private, link-local, and IP-literal hosts", () => {
  for (const h of [
    "https://127.0.0.1",
    "https://10.0.0.5",
    "https://192.168.1.10",
    "https://169.254.169.254",
    "https://172.16.0.1",
    "https://localhost",
    "https://foo.localhost",
    "https://svc.internal",
    "https://[::1]",
    "https://[fe80::1]",
  ]) {
    assert.throws(() => assertSafeBaseUrl(h), /SSRF|loopback|private|IP-literal|https/i, `expected block for ${h}`);
  }
});

test("assertSafeBaseUrl allows a private host only when opted in", () => {
  assert.doesNotThrow(() => assertSafeBaseUrl("https://10.0.0.5", { allowPrivateHost: true }));
});

// normalizePath. encoded traversal and separator smuggling.
test("normalizePath rejects encoded traversal and separators", () => {
  for (const p of [
    "/api/v2/%2e%2e/admin",
    "/api/v2/products%2f..%2fadmin",
    "/api/v2/%2E%2E/x",
    "/api/v2/a%5cb",
    "/api/v2/a\\b",
  ]) {
    assert.throws(() => normalizePath(p), /encoded traversal|separator|traversal/i, `expected block for ${p}`);
  }
});

test("normalizePath still allows a clean api path with brackets and query", () => {
  assert.equal(normalizePath("/api/v2/products?page[size]=10"), "/api/v2/products?page[size]=10");
});

// redactSecrets. shorter tokens and url-encoded occurrences.
test("redactSecrets redacts a 4+ char token and its url-encoded form", () => {
  assert.match(redactSecrets("body has tok1|abcd in it", "tok1|abcd"), /\[REDACTED\]/);
  assert.ok(!redactSecrets("body has tok1|abcd in it", "tok1|abcd").includes("tok1|abcd"));
  // url-encoded occurrence (the pipe becomes %7C).
  const enc = encodeURIComponent("tok1|abcd");
  assert.ok(!redactSecrets(`encoded ${enc} here`, "tok1|abcd").includes(enc));
});

test("redactSecrets still masks a bare Bearer value", () => {
  assert.match(redactSecrets("Authorization: Bearer abc.def-123", "othertoken"), /Bearer \[REDACTED\]/);
});
