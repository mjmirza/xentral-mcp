// Unit tests for src/config-env.ts (env parsing and loading).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadConfigFromEnv,
  resolveBaseUrlFromEnv,
} from "../../src/config-env.js";
import { DEFAULT_TIMEOUT_MS, DEFAULT_MAX_RESPONSE_CHARS } from "../../src/config.js";

// Build a minimal env object. The functions read only the XENTRAL_* keys.
function envOf(over: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return over as NodeJS.ProcessEnv;
}

test("resolveBaseUrlFromEnv reads XENTRAL_API_URL first", () => {
  const base = resolveBaseUrlFromEnv(envOf({ XENTRAL_API_URL: "https://acme.xentral.biz/api/" }));
  assert.equal(base, "https://acme.xentral.biz");
});

test("resolveBaseUrlFromEnv falls back to XENTRAL_ID", () => {
  const base = resolveBaseUrlFromEnv(envOf({ XENTRAL_ID: "acme" }));
  assert.equal(base, "https://acme.xentral.biz");
});

test("resolveBaseUrlFromEnv returns empty when neither is set", () => {
  assert.equal(resolveBaseUrlFromEnv(envOf({})), "");
});

test("loadConfigFromEnv builds a full config from host and token", () => {
  const cfg = loadConfigFromEnv(
    envOf({ XENTRAL_API_URL: "https://acme.xentral.biz", XENTRAL_TOKEN: "tok-abc123" }),
  );
  assert.equal(cfg.baseUrl, "https://acme.xentral.biz");
  assert.equal(cfg.token, "tok-abc123");
  assert.equal(cfg.readonly, true);
  assert.equal(cfg.allowDelete, false);
  assert.equal(cfg.timeoutMs, DEFAULT_TIMEOUT_MS);
  assert.equal(cfg.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS);
});

test("loadConfigFromEnv works from a bare XENTRAL_ID", () => {
  const cfg = loadConfigFromEnv(envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123" }));
  assert.equal(cfg.baseUrl, "https://acme.xentral.biz");
});

test("loadConfigFromEnv trims the token", () => {
  const cfg = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "  tok-abc123  " }),
  );
  assert.equal(cfg.token, "tok-abc123");
});

test("loadConfigFromEnv throws with a setup hint when host is missing", () => {
  assert.throws(
    () => loadConfigFromEnv(envOf({ XENTRAL_TOKEN: "tok-abc123" })),
    /Missing instance host.*setup/s,
  );
});

test("loadConfigFromEnv throws with a setup hint when token is missing", () => {
  assert.throws(
    () => loadConfigFromEnv(envOf({ XENTRAL_ID: "acme" })),
    /Missing token.*setup/s,
  );
  assert.throws(
    () => loadConfigFromEnv(envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "   " })),
    /Missing token/,
  );
});

// READONLY parsing table. Default is true.
const readonlyTrue = ["1", "true", "yes", "on", "TRUE", "  On  ", "YES"];
const readonlyFalse = ["0", "false", "no", "off", "FALSE", "  Off  ", "NO"];

for (const val of readonlyTrue) {
  test(`XENTRAL_MCP_READONLY '${val}' parses to true`, () => {
    const cfg = loadConfigFromEnv(
      envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_READONLY: val }),
    );
    assert.equal(cfg.readonly, true);
  });
}

for (const val of readonlyFalse) {
  test(`XENTRAL_MCP_READONLY '${val}' parses to false`, () => {
    const cfg = loadConfigFromEnv(
      envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_READONLY: val }),
    );
    assert.equal(cfg.readonly, false);
  });
}

test("XENTRAL_MCP_READONLY missing or empty defaults to true", () => {
  const missing = loadConfigFromEnv(envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123" }));
  assert.equal(missing.readonly, true);
  const empty = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_READONLY: "" }),
  );
  assert.equal(empty.readonly, true);
});

test("XENTRAL_MCP_READONLY garbage falls back to the default (true)", () => {
  const cfg = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_READONLY: "maybe" }),
  );
  assert.equal(cfg.readonly, true);
});

// ALLOW_DELETE parsing. Default is false.
test("XENTRAL_MCP_ALLOW_DELETE default is false", () => {
  const cfg = loadConfigFromEnv(envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123" }));
  assert.equal(cfg.allowDelete, false);
});

for (const val of readonlyTrue) {
  test(`XENTRAL_MCP_ALLOW_DELETE '${val}' parses to true`, () => {
    const cfg = loadConfigFromEnv(
      envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_ALLOW_DELETE: val }),
    );
    assert.equal(cfg.allowDelete, true);
  });
}

for (const val of readonlyFalse) {
  test(`XENTRAL_MCP_ALLOW_DELETE '${val}' parses to false`, () => {
    const cfg = loadConfigFromEnv(
      envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_ALLOW_DELETE: val }),
    );
    assert.equal(cfg.allowDelete, false);
  });
}

test("XENTRAL_MCP_ALLOW_DELETE garbage falls back to false", () => {
  const cfg = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_ALLOW_DELETE: "sure" }),
  );
  assert.equal(cfg.allowDelete, false);
});

// Numeric env parsing.
test("XENTRAL_MCP_TIMEOUT_MS parses a positive integer", () => {
  const cfg = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_TIMEOUT_MS: "12000" }),
  );
  assert.equal(cfg.timeoutMs, 12000);
});

test("XENTRAL_MCP_TIMEOUT_MS garbage falls back to the default", () => {
  const bad = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_TIMEOUT_MS: "abc" }),
  );
  assert.equal(bad.timeoutMs, DEFAULT_TIMEOUT_MS);
});

test("XENTRAL_MCP_TIMEOUT_MS zero or negative falls back to the default", () => {
  const zero = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_TIMEOUT_MS: "0" }),
  );
  assert.equal(zero.timeoutMs, DEFAULT_TIMEOUT_MS);
  const neg = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_TIMEOUT_MS: "-5" }),
  );
  assert.equal(neg.timeoutMs, DEFAULT_TIMEOUT_MS);
});

test("XENTRAL_MAX_RESPONSE_CHARS parses and falls back on garbage", () => {
  const good = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MAX_RESPONSE_CHARS: "5000" }),
  );
  assert.equal(good.maxResponseChars, 5000);
  const bad = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MAX_RESPONSE_CHARS: "NaN" }),
  );
  assert.equal(bad.maxResponseChars, DEFAULT_MAX_RESPONSE_CHARS);
});

test("XENTRAL_MCP_TIMEOUT_MS with trailing text parses the leading integer", () => {
  // parseInt reads the leading digits, so 100px yields 100.
  const cfg = loadConfigFromEnv(
    envOf({ XENTRAL_ID: "acme", XENTRAL_TOKEN: "tok-abc123", XENTRAL_MCP_TIMEOUT_MS: "100px" }),
  );
  assert.equal(cfg.timeoutMs, 100);
});
