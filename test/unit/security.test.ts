// Unit tests for src/security.ts (path and method safety).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePath, normalizeMethod, isWrite } from "../../src/security.js";

// normalizePath happy paths.
test("normalizePath returns a valid /api/ path unchanged", () => {
  assert.equal(normalizePath("/api/v2/products"), "/api/v2/products");
});

test("normalizePath prepends a leading slash when missing", () => {
  assert.equal(normalizePath("api/v2/products"), "/api/v2/products");
});

test("normalizePath trims whitespace before validating", () => {
  assert.equal(normalizePath("  /api/v2/products  "), "/api/v2/products");
});

test("normalizePath keeps brackets in the path (a bracket filter is not a query)", () => {
  assert.equal(
    normalizePath("/api/v2/products/filter[0][key]"),
    "/api/v2/products/filter[0][key]",
  );
});

test("normalizePath rejects a query string in the path (query goes in the query field)", () => {
  assert.throws(
    () => normalizePath("/api/v2/products?page[size]=10"),
    /query .*\?.* or fragment/i,
  );
});

// normalizePath rejections.
test("normalizePath rejects an empty string", () => {
  assert.throws(() => normalizePath(""), /Path is empty/);
  assert.throws(() => normalizePath("   "), /Path is empty/);
});

test("normalizePath rejects a full URL", () => {
  assert.throws(() => normalizePath("https://evil.example.com/api/v2/products"), /relative/);
  assert.throws(() => normalizePath("http://evil.example.com"), /relative/);
  assert.throws(() => normalizePath("ftp://host/api/x"), /relative/);
});

test("normalizePath rejects a protocol relative path", () => {
  assert.throws(() => normalizePath("//evil.example.com/api/x"), /protocol relative/);
});

test("normalizePath rejects an embedded control character", () => {
  assert.throws(() => normalizePath("/api/v2/products"), /control characters/);
  assert.throws(() => normalizePath("/api/v2/prod\tucts"), /control characters/);
  assert.throws(() => normalizePath("/api/v2/products"), /control characters/);
});

test("normalizePath rejects a CRLF injection attempt", () => {
  assert.throws(() => normalizePath("/api/v2/x\r\nHost: evil"), /control characters/);
});

test("normalizePath rejects path traversal", () => {
  assert.throws(() => normalizePath("/api/../secret"), /traversal/);
  assert.throws(() => normalizePath("/api/v2/../../etc"), /traversal/);
});

test("normalizePath rejects a path not under /api/", () => {
  assert.throws(() => normalizePath("/v2/products"), /must start with \/api\//);
  assert.throws(() => normalizePath("/apix/products"), /must start with \/api\//);
  assert.throws(() => normalizePath("products"), /must start with \/api\//);
});

test("normalizePath is idempotent on a clean value", () => {
  const once = normalizePath("api/v2/products");
  const twice = normalizePath(once);
  assert.equal(twice, once);
});

// normalizeMethod.
test("normalizeMethod uppercases a lowercase method", () => {
  assert.equal(normalizeMethod("get"), "GET");
  assert.equal(normalizeMethod("post"), "POST");
  assert.equal(normalizeMethod("  patch  "), "PATCH");
});

test("normalizeMethod accepts every allowed method", () => {
  for (const m of ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"]) {
    assert.equal(normalizeMethod(m), m);
  }
});

test("normalizeMethod defaults to GET when the input is undefined", () => {
  assert.equal(normalizeMethod(undefined as unknown as string), "GET");
});

test("normalizeMethod rejects an unknown method", () => {
  assert.throws(() => normalizeMethod("FETCH"), /Unsupported method/);
  assert.throws(() => normalizeMethod("TRACE"), /Unsupported method/);
  assert.throws(() => normalizeMethod("CONNECT"), /Unsupported method/);
});

test("normalizeMethod rejects an empty string", () => {
  assert.throws(() => normalizeMethod(""), /Unsupported method/);
});

// isWrite.
test("isWrite treats read methods as non writes", () => {
  assert.equal(isWrite("GET"), false);
  assert.equal(isWrite("HEAD"), false);
  assert.equal(isWrite("OPTIONS"), false);
  assert.equal(isWrite("get"), false);
});

test("isWrite treats mutating methods as writes", () => {
  assert.equal(isWrite("POST"), true);
  assert.equal(isWrite("PUT"), true);
  assert.equal(isWrite("PATCH"), true);
  assert.equal(isWrite("DELETE"), true);
  assert.equal(isWrite("delete"), true);
});

test("isWrite throws on an unknown method through normalizeMethod", () => {
  assert.throws(() => isWrite("BOGUS"), /Unsupported method/);
});
