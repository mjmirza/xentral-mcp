// Unit tests for the OAuth request codec in src/oauth/authorize.ts.
// The base64url form is the fix for the "authorization request expired" error,
// which was standard base64 getting a + mangled into a space inside the form.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import { encodeAuthRequest, decodeAuthRequest } from "../../src/oauth/authorize.js";

// A representative parsed authorization request.
const req = {
  responseType: "code",
  clientId: "client-abc-123",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
  scope: ["xentral.read"],
  state: "st/at+e=with?special&chars",
  codeChallenge: "aB3-_dEf0123456789xyzABCDEFGHIJKLMNOPQRST",
  codeChallengeMethod: "S256",
} as unknown as AuthRequest;

test("the request round trips through the codec exactly", () => {
  const back = decodeAuthRequest(encodeAuthRequest(req));
  assert.deepEqual(back, req);
});

test("the carried value is URL-safe base64url, no +, /, or = ", () => {
  // Force bytes that standard base64 would render with + and /.
  const heavy = { ...req, state: "ÿþýüûúùø" } as unknown as AuthRequest;
  const carried = encodeAuthRequest(heavy);
  assert.ok(!/[+/=]/.test(carried), `carried value must be URL-safe, got: ${carried}`);
  assert.deepEqual(decodeAuthRequest(carried), heavy);
});

test("the reader still accepts a legacy standard-base64 value", () => {
  // Simulate an old in-flight value written with standard base64 (with padding).
  const json = JSON.stringify(req);
  const std = Buffer.from(json, "utf8").toString("base64"); // standard, may carry +/=
  assert.deepEqual(decodeAuthRequest(std), req);
});

test("the reader tolerates surrounding whitespace", () => {
  const carried = encodeAuthRequest(req);
  assert.deepEqual(decodeAuthRequest(`  ${carried}\n`), req);
});

test("the reader throws on an empty value, garbage, or a non-request object", () => {
  assert.throws(() => decodeAuthRequest(""));
  assert.throws(() => decodeAuthRequest("!!!not base64!!!"));
  // Valid base64 of JSON that is not an auth request (no clientId).
  const notReq = Buffer.from(JSON.stringify({ hello: "world" }), "utf8").toString("base64");
  assert.throws(() => decodeAuthRequest(notReq), /not a valid authorization request/);
});
