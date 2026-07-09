// Unit tests for the connector icon in src/icon.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ICON_DATA_URI, iconPngBytes, serverIcons } from "../../src/icon.js";

test("ICON_DATA_URI is a PNG data URI", () => {
  assert.match(ICON_DATA_URI, /^data:image\/png;base64,/);
  assert.ok(ICON_DATA_URI.length > 1000, "icon carries real image bytes");
});

test("iconPngBytes returns real PNG bytes (PNG magic number)", () => {
  const bytes = iconPngBytes();
  assert.ok(bytes.length > 500);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  assert.deepEqual([...bytes.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test("serverIcons returns the MCP icons array shape", () => {
  const icons = serverIcons();
  assert.equal(icons.length, 1);
  assert.equal(icons[0].mimeType, "image/png");
  assert.equal(icons[0].src, ICON_DATA_URI);
  assert.ok(Array.isArray(icons[0].sizes));
});

test("serverIcons accepts an override src (a hosted https url)", () => {
  const icons = serverIcons("https://example.com/icon.png");
  assert.equal(icons[0].src, "https://example.com/icon.png");
});
