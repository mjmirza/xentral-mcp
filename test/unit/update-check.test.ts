// Unit tests for the CLI update check (src/setup/update-check.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isNewer, maybeNotifyUpdate } from "../../src/setup/update-check.js";

test("isNewer detects a newer patch, minor, and major", () => {
  assert.equal(isNewer("0.1.2", "0.1.1"), true);
  assert.equal(isNewer("0.2.0", "0.1.9"), true);
  assert.equal(isNewer("1.0.0", "0.9.9"), true);
});

test("isNewer is false for equal or older versions", () => {
  assert.equal(isNewer("0.1.1", "0.1.1"), false);
  assert.equal(isNewer("0.1.0", "0.1.1"), false);
  assert.equal(isNewer("0.0.9", "0.1.0"), false);
  assert.equal(isNewer("1.9.9", "2.0.0"), false);
});

test("isNewer treats missing or non-numeric parts as zero, never throws", () => {
  assert.equal(isNewer("0.1", "0.1.0"), false);
  assert.equal(isNewer("0.1.1", "0.1"), true);
  assert.doesNotThrow(() => isNewer("", ""));
  assert.doesNotThrow(() => isNewer("garbage", "0.1.1"));
  assert.equal(isNewer("garbage", "0.1.1"), false);
});

test("maybeNotifyUpdate stays silent and never throws when the check is disabled", async () => {
  const original = process.stderr.write.bind(process.stderr);
  let captured = "";
  // @ts-expect-error narrow override for the test
  process.stderr.write = (chunk: string) => {
    captured += chunk;
    return true;
  };
  process.env.XENTRAL_MCP_NO_UPDATE_CHECK = "1";
  try {
    await assert.doesNotReject(() => maybeNotifyUpdate("0.1.1"));
    assert.equal(captured, "");
  } finally {
    process.stderr.write = original;
    delete process.env.XENTRAL_MCP_NO_UPDATE_CHECK;
  }
});
