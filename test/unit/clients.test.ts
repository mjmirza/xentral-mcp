// Unit tests for src/setup/clients.ts (client targets + install detection).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clientTargets,
  findClient,
  isLikelyInstalled,
  buildServerEntry,
  mergeServerIntoConfig,
} from "../../src/setup/clients.js";

test("clientTargets lists the five known clients with config keys", () => {
  const ids = clientTargets().map((c) => c.id);
  for (const id of ["claude-desktop", "claude-code", "cursor", "windsurf", "vscode"]) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
  // VS Code uses the servers key and needs a type field, the others do not.
  assert.equal(findClient("vscode")?.configKey, "servers");
  assert.equal(findClient("vscode")?.needsType, true);
  assert.equal(findClient("cursor")?.needsType, false);
});

test("isLikelyInstalled is false for a target with no config path, never throws", () => {
  assert.equal(isLikelyInstalled({ id: "x", label: "x", configKey: "mcpServers", needsType: false, configPath: null }), false);
  // A bogus path that does not exist is false, not an error.
  assert.doesNotThrow(() =>
    isLikelyInstalled({ id: "x", label: "x", configKey: "mcpServers", needsType: false, configPath: "/no/such/path/mcp.json" }),
  );
});

test("buildServerEntry runs the published bin via npx, with a type only when needed", () => {
  const plain = buildServerEntry({ A: "1" }, false);
  assert.deepEqual(plain, { command: "npx", args: ["-y", "xentral-mcp"], env: { A: "1" } });
  const typed = buildServerEntry({ A: "1" }, true);
  assert.equal(typed.type, "stdio");
});

test("mergeServerIntoConfig adds xentral without clobbering other servers or keys", () => {
  const existing = { mcpServers: { other: { command: "keep" } }, unrelated: 7 };
  const entry = buildServerEntry({ X: "1" }, false);
  const merged = mergeServerIntoConfig(existing, entry, "mcpServers");
  assert.equal((merged.unrelated as number), 7);
  assert.ok((merged.mcpServers as Record<string, unknown>).other, "other server preserved");
  assert.ok((merged.mcpServers as Record<string, unknown>).xentral, "xentral added");
  // The original object is not mutated.
  assert.equal(Object.keys(existing.mcpServers).length, 1);
});
