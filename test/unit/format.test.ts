// Unit tests for src/format.ts (token lean response formatting).
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatResponse } from "../../src/format.js";

const big = { verbose: false, maxChars: 100000 };
const verbose = { verbose: true, maxChars: 100000 };

test("non verbose mode strips empty fields", () => {
  const out = formatResponse(
    { id: 1, name: "Widget", note: "", tags: [], meta: {}, missing: null },
    big,
  );
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed, { id: 1, name: "Widget" });
});

test("non verbose mode drops undefined fields", () => {
  const out = formatResponse({ a: 1, b: undefined }, big);
  assert.deepEqual(JSON.parse(out), { a: 1 });
});

test("non verbose mode prunes nested empty structures", () => {
  const out = formatResponse(
    { keep: "yes", nested: { drop: "", inner: { alsoDrop: null } } },
    big,
  );
  assert.deepEqual(JSON.parse(out), { keep: "yes" });
});

test("non verbose mode prunes empty array members", () => {
  const out = formatResponse({ items: [{ a: 1 }, {}, { b: "" }, { c: 2 }] }, big);
  assert.deepEqual(JSON.parse(out), { items: [{ a: 1 }, { c: 2 }] });
});

test("verbose mode passes the full payload through", () => {
  const input = { id: 1, name: "Widget", note: "", tags: [], meta: {} };
  const out = formatResponse(input, verbose);
  assert.deepEqual(JSON.parse(out), input);
});

test("verbose mode pretty prints with two space indent", () => {
  const out = formatResponse({ a: 1 }, verbose);
  assert.match(out, /\n {2}"a": 1/);
});

test("V3 envelope keeps extra intact and prunes data rows", () => {
  const input = {
    data: [{ id: 1, empty: "" }, { id: 2, tags: [] }],
    extra: { total: 2, cursor: "abc", emptyLooking: "" },
  };
  const out = formatResponse(input, big);
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.data, [{ id: 1 }, { id: 2 }]);
  // extra is preserved as is, including its empty looking field.
  assert.deepEqual(parsed.extra, { total: 2, cursor: "abc", emptyLooking: "" });
});

test("V3 envelope with only extra keeps it", () => {
  const out = formatResponse({ extra: { total: 0 } }, big);
  assert.deepEqual(JSON.parse(out), { extra: { total: 0 } });
});

test("envelope keeps other top level fields when not empty", () => {
  const input = { data: [{ id: 1 }], extra: { total: 1 }, meta: "kept", blank: "" };
  const out = formatResponse(input, big);
  const parsed = JSON.parse(out);
  assert.equal(parsed.meta, "kept");
  assert.ok(!("blank" in parsed));
});

test("plain array input is pruned member by member", () => {
  const out = formatResponse([{ a: 1, x: "" }, {}, { b: 2 }], big);
  assert.deepEqual(JSON.parse(out), [{ a: 1 }, { b: 2 }]);
});

test("null input formats to the literal null", () => {
  assert.equal(formatResponse(null, big), "null");
});

test("undefined input formats to the literal null instead of throwing", () => {
  // A 204 no content response gives an undefined body. JSON.stringify(undefined)
  // yields the value undefined, so the formatter falls back to the string null
  // rather than throwing on text.length.
  assert.equal(formatResponse(undefined, big), "null");
});

test("a primitive string input round trips through JSON", () => {
  assert.equal(formatResponse("hello", big), '"hello"');
});

test("truncation adds a clear marker and caps the length", () => {
  const rows = Array.from({ length: 500 }, (_, i) => ({ id: i, name: `row-${i}` }));
  const out = formatResponse({ data: rows }, { verbose: false, maxChars: 200 });
  assert.match(out, /Output truncated at 200 characters/);
  // The sliced payload plus the note. The slice itself is exactly maxChars.
  const noteIndex = out.indexOf("\n\n[Output truncated");
  assert.equal(noteIndex, 200);
});

test("a huge object is truncated to at most maxChars plus the note", () => {
  const huge = { blob: "x".repeat(100000) };
  const max = 500;
  const out = formatResponse(huge, { verbose: false, maxChars: max });
  const body = out.slice(0, out.indexOf("\n\n[Output truncated"));
  assert.equal(body.length, max);
});

test("output under the cap is returned without a marker", () => {
  const out = formatResponse({ a: 1 }, { verbose: false, maxChars: 100 });
  assert.ok(!out.includes("Output truncated"));
});

test("special regex characters in values are preserved verbatim", () => {
  const input = { pattern: ".*+?^${}()|[]\\" };
  const out = formatResponse(input, big);
  assert.equal(JSON.parse(out).pattern, ".*+?^${}()|[]\\");
});

test("CRLF and unicode content round trips", () => {
  const input = { text: "line1\r\nline2", name: "grüße über" };
  const out = formatResponse(input, big);
  const parsed = JSON.parse(out);
  assert.equal(parsed.text, "line1\r\nline2");
  assert.equal(parsed.name, "grüße über");
});

test("formatResponse is idempotent for the same input and options", () => {
  const input = { data: [{ id: 1, empty: "" }], extra: { total: 1 } };
  const first = formatResponse(input, big);
  const second = formatResponse(input, big);
  assert.equal(first, second);
});

test("empty object input yields an empty object string", () => {
  assert.equal(formatResponse({}, big), "{}");
});
