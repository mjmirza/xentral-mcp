// Unit tests for src/crypto.ts (AES-256-GCM token encryption via WebCrypto).
import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptToken, decryptToken, userIdForInstance } from "../../src/crypto.js";

// A high entropy machine secret. Any non empty string works, the module
// takes its SHA-256 digest as the AES key.
const SECRET = "test-secret-value-with-plenty-of-entropy-0123456789";
const OTHER_SECRET = "a-different-machine-secret-abcdefghijklmnop";

test("encrypt then decrypt round trips the plaintext", async () => {
  const plain = "pat-1234567890";
  const enc = await encryptToken(plain, SECRET);
  const back = await decryptToken(enc, SECRET);
  assert.equal(back, plain);
});

test("the encrypted record is JSON with base64 iv and ciphertext", async () => {
  const enc = await encryptToken("hello", SECRET);
  const rec = JSON.parse(enc);
  assert.equal(typeof rec.iv, "string");
  assert.equal(typeof rec.ciphertext, "string");
  // base64 decodes without throwing.
  assert.doesNotThrow(() => atob(rec.iv));
  assert.doesNotThrow(() => atob(rec.ciphertext));
});

test("the ciphertext does not contain the plaintext", async () => {
  const plain = "very-visible-plaintext";
  const enc = await encryptToken(plain, SECRET);
  assert.ok(!enc.includes(plain));
});

test("a fresh iv is used per call so two encryptions differ", async () => {
  const a = await encryptToken("same", SECRET);
  const b = await encryptToken("same", SECRET);
  assert.notEqual(a, b);
});

test("decrypt with the wrong key fails", async () => {
  const enc = await encryptToken("secret-data", SECRET);
  await assert.rejects(() => decryptToken(enc, OTHER_SECRET));
});

test("a tampered ciphertext fails the auth tag check", async () => {
  const enc = await encryptToken("secret-data", SECRET);
  const rec = JSON.parse(enc);
  // Flip a base64 character in the ciphertext.
  const chars = rec.ciphertext.split("");
  chars[0] = chars[0] === "A" ? "B" : "A";
  rec.ciphertext = chars.join("");
  await assert.rejects(() => decryptToken(JSON.stringify(rec), SECRET));
});

test("a malformed record string throws a clear error", async () => {
  await assert.rejects(() => decryptToken("not json at all", SECRET), /malformed/);
});

test("a record missing a field throws a clear error", async () => {
  await assert.rejects(
    () => decryptToken(JSON.stringify({ iv: "abc" }), SECRET),
    /missing a field/,
  );
});

test("encrypt with an empty secret throws a setup error", async () => {
  await assert.rejects(() => encryptToken("x", ""), /Missing TOKEN_ENCRYPTION_KEY/);
  await assert.rejects(() => encryptToken("x", "   "), /Missing TOKEN_ENCRYPTION_KEY/);
});

test("an empty string plaintext round trips", async () => {
  const enc = await encryptToken("", SECRET);
  const back = await decryptToken(enc, SECRET);
  assert.equal(back, "");
});

test("a unicode plaintext round trips", async () => {
  const plain = "grüße-über-99-账户-🔐";
  const enc = await encryptToken(plain, SECRET);
  const back = await decryptToken(enc, SECRET);
  assert.equal(back, plain);
});

test("a large 100k plaintext round trips", async () => {
  const plain = "x".repeat(100000);
  const enc = await encryptToken(plain, SECRET);
  const back = await decryptToken(enc, SECRET);
  assert.equal(back, plain);
  assert.equal(back.length, 100000);
});

test("special characters in the plaintext round trip", async () => {
  const plain = ".*+?^${}()|[]\\\t\r\n\"'";
  const enc = await encryptToken(plain, SECRET);
  const back = await decryptToken(enc, SECRET);
  assert.equal(back, plain);
});

test("userIdForInstance returns a stable xentral prefixed id", async () => {
  const a = await userIdForInstance("https://acme.xentral.biz");
  const b = await userIdForInstance("https://acme.xentral.biz");
  assert.equal(a, b);
  assert.match(a, /^xentral-[0-9a-f]{32}$/);
});

test("userIdForInstance differs per host and hides the host", async () => {
  const a = await userIdForInstance("https://acme.xentral.biz");
  const b = await userIdForInstance("https://other.xentral.biz");
  assert.notEqual(a, b);
  assert.ok(!a.includes("acme"));
  assert.ok(!a.includes(":"));
});
