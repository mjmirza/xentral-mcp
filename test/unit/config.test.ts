// Unit tests for src/config.ts (pure config logic).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBaseUrl,
  baseFromId,
  resolveBaseUrl,
  buildConfig,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RESPONSE_CHARS,
} from "../../src/config.js";

test("DEFAULT constants hold the documented values", () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 30000);
  assert.equal(DEFAULT_MAX_RESPONSE_CHARS, 20000);
});

test("normalizeBaseUrl strips trailing slashes", () => {
  assert.equal(normalizeBaseUrl("https://acme.xentral.biz/"), "https://acme.xentral.biz");
  assert.equal(normalizeBaseUrl("https://acme.xentral.biz///"), "https://acme.xentral.biz");
});

test("normalizeBaseUrl strips a trailing /api segment", () => {
  assert.equal(normalizeBaseUrl("https://acme.xentral.biz/api"), "https://acme.xentral.biz");
  assert.equal(normalizeBaseUrl("https://acme.xentral.biz/API"), "https://acme.xentral.biz");
  assert.equal(normalizeBaseUrl("https://acme.xentral.biz/api/"), "https://acme.xentral.biz");
});

test("normalizeBaseUrl trims whitespace", () => {
  assert.equal(normalizeBaseUrl("  https://acme.xentral.biz  "), "https://acme.xentral.biz");
});

test("normalizeBaseUrl leaves a clean host untouched (idempotent)", () => {
  const once = normalizeBaseUrl("https://acme.xentral.biz");
  const twice = normalizeBaseUrl(once);
  assert.equal(once, "https://acme.xentral.biz");
  assert.equal(twice, once);
});

test("normalizeBaseUrl on empty input returns empty", () => {
  assert.equal(normalizeBaseUrl(""), "");
  assert.equal(normalizeBaseUrl("   "), "");
});

test("baseFromId expands a bare id to https host", () => {
  assert.equal(baseFromId("acme"), "https://acme.xentral.biz");
});

test("baseFromId strips a leading scheme and any path", () => {
  assert.equal(baseFromId("https://acme"), "https://acme.xentral.biz");
  assert.equal(baseFromId("http://acme/whatever"), "https://acme.xentral.biz");
  assert.equal(baseFromId("acme/foo/bar"), "https://acme.xentral.biz");
});

test("baseFromId trims whitespace around the id", () => {
  assert.equal(baseFromId("  acme  "), "https://acme.xentral.biz");
});

test("resolveBaseUrl prefers apiUrl over id and normalizes it", () => {
  assert.equal(
    resolveBaseUrl("https://acme.xentral.biz/api/", "other"),
    "https://acme.xentral.biz",
  );
});

test("resolveBaseUrl falls back to id when apiUrl is empty", () => {
  assert.equal(resolveBaseUrl("", "acme"), "https://acme.xentral.biz");
  assert.equal(resolveBaseUrl("   ", "acme"), "https://acme.xentral.biz");
});

test("resolveBaseUrl returns empty string when neither is present", () => {
  assert.equal(resolveBaseUrl(), "");
  assert.equal(resolveBaseUrl("", ""), "");
  assert.equal(resolveBaseUrl(undefined, undefined), "");
});

test("resolveBaseUrl prepends https for a bare apiUrl host with no scheme", () => {
  // A scheme-less host would build an invalid request URL, so the normalizer
  // adds https. A host that already carries a scheme is left as is.
  assert.equal(resolveBaseUrl("acme.xentral.biz"), "https://acme.xentral.biz");
  assert.equal(resolveBaseUrl("acme.xentral.biz/api/"), "https://acme.xentral.biz");
  assert.equal(resolveBaseUrl("http://acme.xentral.biz"), "http://acme.xentral.biz");
});

test("buildConfig applies defaults for the optional fields", () => {
  const cfg = buildConfig({ baseUrl: "https://acme.xentral.biz", token: "tok-abc123" });
  assert.equal(cfg.baseUrl, "https://acme.xentral.biz");
  assert.equal(cfg.token, "tok-abc123");
  assert.equal(cfg.timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(cfg.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS);
  assert.equal(cfg.readonly, true);
  assert.equal(cfg.allowDelete, false);
});

test("buildConfig normalizes the host and trims the token", () => {
  const cfg = buildConfig({ baseUrl: "https://acme.xentral.biz/api/", token: "  tok-abc123  " });
  assert.equal(cfg.baseUrl, "https://acme.xentral.biz");
  assert.equal(cfg.token, "tok-abc123");
});

test("buildConfig honors explicit overrides", () => {
  const cfg = buildConfig({
    baseUrl: "https://acme.xentral.biz",
    token: "tok-abc123",
    timeoutMs: 5000,
    maxResponseChars: 999,
    readonly: false,
    allowDelete: true,
  });
  assert.equal(cfg.timeoutMs, 5000);
  assert.equal(cfg.maxResponseChars, 999);
  assert.equal(cfg.readonly, false);
  assert.equal(cfg.allowDelete, true);
});

test("buildConfig falls back to defaults on non positive numeric input", () => {
  const zero = buildConfig({
    baseUrl: "https://acme.xentral.biz",
    token: "tok-abc123",
    timeoutMs: 0,
    maxResponseChars: 0,
  });
  assert.equal(zero.timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(zero.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS);

  const negative = buildConfig({
    baseUrl: "https://acme.xentral.biz",
    token: "tok-abc123",
    timeoutMs: -10,
    maxResponseChars: -1,
  });
  assert.equal(negative.timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(negative.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS);
});

test("buildConfig throws a clear error when the host is missing", () => {
  assert.throws(
    () => buildConfig({ baseUrl: "", token: "tok-abc123" }),
    /Missing instance host/,
  );
});

test("buildConfig throws when the token is missing or whitespace only", () => {
  assert.throws(
    () => buildConfig({ baseUrl: "https://acme.xentral.biz", token: "" }),
    /Missing token/,
  );
  assert.throws(
    () => buildConfig({ baseUrl: "https://acme.xentral.biz", token: "   " }),
    /Missing token/,
  );
});

test("buildConfig readonly false with allowDelete false stays a distinct pair", () => {
  const cfg = buildConfig({
    baseUrl: "https://acme.xentral.biz",
    token: "tok-abc123",
    readonly: false,
  });
  assert.equal(cfg.readonly, false);
  assert.equal(cfg.allowDelete, false);
});
