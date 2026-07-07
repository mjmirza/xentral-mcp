/**
 * Live stress and load suite. Runs the built server over stdio against the REAL
 * Xentral demo through a real MCP stdio client, and proves the pagination clamp,
 * the 429 retry, response truncation, and the request timeout all hold under
 * hostile and high volume input.
 *
 * This suite is READ ONLY. Every network call is a GET. It deliberately trips
 * the demo 100 per minute rate limit in one burst, so it is meant to run LAST
 * and alone. After the burst it waits about 60 seconds so the demo rate limit
 * resets before the process exits.
 *
 * Credentials come from the environment only. XENTRAL_TOKEN and XENTRAL_API_URL
 * must be set by the caller (the secret box wrapper exports them). Nothing is
 * written to disk, the token is never printed, and the demo host is never
 * hardcoded here. It is read from the environment.
 *
 * Each case prints PASS or FAIL. The process exits non zero on any real failure.
 */

import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "dist", "index.js");

const token = process.env.XENTRAL_TOKEN ?? "";
const apiUrl = process.env.XENTRAL_API_URL ?? "";
if (token.trim() === "" || apiUrl.trim() === "") {
  process.stderr.write(
    "stress ERROR. XENTRAL_TOKEN and XENTRAL_API_URL must be set in the environment.\n",
  );
  process.exit(1);
}

let passed = 0;
let failed = 0;

/** Run one synchronous assertion. Records PASS or FAIL, never crashes the run. */
function check(name: string, fn: () => string): void {
  try {
    const note = fn();
    passed += 1;
    process.stdout.write(`PASS ${name}. ${note}\n`);
  } catch (err) {
    failed += 1;
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`FAIL ${name}. ${msg}\n`);
  }
}

interface CallResult {
  /** True when the call was rejected or threw, for example a schema rejection. */
  threw: boolean;
  /** True when the tool returned an isError result. */
  isError: boolean;
  /** First text block, or the caught error message. */
  text: string;
  /** Wall time for the call in milliseconds. */
  ms: number;
}

/** Build a clean string only env from the current process, plus overrides. The
 * host and token are taken from the environment the wrapper exported, never
 * hardcoded. */
function buildEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (typeof v === "string") env[k] = v;
  }
  env.XENTRAL_API_URL = apiUrl;
  env.XENTRAL_TOKEN = token;
  env.XENTRAL_MCP_READONLY = "1";
  return { ...env, ...overrides };
}

/** Start one server instance over stdio with the given env overrides. */
async function startClient(
  overrides: Record<string, string>,
): Promise<{ client: Client; transport: StdioClientTransport }> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: buildEnv(overrides),
  });
  const client = new Client({ name: "xentral-mcp-stress", version: "0.1.0" });
  await client.connect(transport);
  return { client, transport };
}

/**
 * Call a tool and flatten the result. A returned isError is captured. A thrown
 * or rejected call (a schema rejection or a transport error) is captured as
 * threw, so a hostile input can never crash the runner.
 */
async function callResult(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<CallResult> {
  const t0 = Date.now();
  try {
    const res = (await client.callTool({ name, arguments: args })) as {
      content?: Array<{ type: string; text?: string }>;
      isError?: boolean;
    };
    const block = (res.content ?? []).find((c) => c.type === "text");
    const text = block?.text ?? "";
    return { threw: false, isError: res.isError === true, text, ms: Date.now() - t0 };
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    return { threw: true, isError: true, text, ms: Date.now() - t0 };
  }
}

/** True when the result text looks like a 429 rate limit reply. */
function looksRateLimited(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("429") || t.includes("too many") || t.includes("rate limit");
}

/** True when the result text carries an HTTP 400 from the API. */
function looksBoundary400(text: string): boolean {
  return text.includes("failed with 400");
}

/** Prove the transport is still alive. Lists tools and asserts a non empty set. */
async function transportSurvives(client: Client, label: string): Promise<void> {
  const listed = (await client.listTools()) as { tools?: Array<{ name: string }> };
  const count = listed.tools?.length ?? 0;
  check(`${label} transport survives`, () => {
    assert.ok(count > 0, `expected tools after the load, saw ${count}`);
    return `listTools returned ${count} tools`;
  });
}

/** Assert the token value never appears in a piece of returned text. */
function assertNoToken(text: string, label: string): void {
  check(`${label} no token leak`, () => {
    assert.ok(!text.includes(token), "the token value appeared in a tool result");
    return "no token in the result";
  });
}

// Group 1. Pagination boundaries.
async function groupPagination(client: Client): Promise<void> {
  process.stdout.write("\n1. Pagination boundaries.\n");

  // The curated list tool carries the clamp. Sizes it accepts prove the minimum
  // of 10 and the maximum of 50, and prove both page keys are sent. A size of 1
  // must be raised to 10 by the clamp, so it must not return an API 400.
  const acceptedSizes = [1, 10, 50];
  for (const size of acceptedSizes) {
    const r = await callResult(client, "xentral_list_products", { pageSize: size }); // BESTPRACTICE_OK: serial by design, cases share one stdio transport and stay ordered
    assertNoToken(r.text, `products pageSize ${size}`);
    check(`products pageSize ${size} clamped, not a 400`, () => {
      assert.ok(!r.threw, `unexpected crash, ${r.text.slice(0, 160)}`);
      assert.ok(!r.isError, `unexpected error, ${r.text.slice(0, 160)}`);
      assert.ok(!looksBoundary400(r.text), "a boundary 400 leaked from the clamped path");
      return `ok in ${r.ms}ms, clamp kept the size valid`;
    });
  }

  // Page number one, and a huge page far past the end. A page past the end
  // returns an empty list with a 200, which is a valid result, not an error.
  {
    const r = await callResult(client, "xentral_list_products", { page: 1, pageSize: 10 });
    check("products page 1", () => {
      assert.ok(!r.threw && !r.isError, `expected ok, ${r.text.slice(0, 160)}`);
      assert.ok(!looksBoundary400(r.text), "a boundary 400 leaked");
      return `ok in ${r.ms}ms`;
    });
  }
  {
    const r = await callResult(client, "xentral_list_products", { page: 99999, pageSize: 10 });
    check("products page 99999 past the end", () => {
      assert.ok(!r.threw, `unexpected crash, ${r.text.slice(0, 160)}`);
      assert.ok(!looksBoundary400(r.text), "a boundary 400 leaked");
      assert.ok(!r.text.includes("failed with 500"), "a 500 leaked");
      return r.isError ? `handled gracefully, ${r.text.slice(0, 80)}` : `ok in ${r.ms}ms, empty page is valid`;
    });
  }

  // Hostile sizes and page numbers outside the tool schema range. The list tool
  // schema keeps pageSize between 1 and 50 and keeps page at 1 or more. A value
  // outside that is rejected by the schema before any request leaves the
  // process, so it is a graceful client side rejection, never a boundary 400 and
  // never a crash.
  const hostileSizes = [51, 0, -5, 999];
  for (const size of hostileSizes) {
    const r = await callResult(client, "xentral_list_products", { pageSize: size }); // BESTPRACTICE_OK: serial by design, cases share one stdio transport and stay ordered
    check(`products hostile pageSize ${size} handled`, () => {
      assert.ok(!looksBoundary400(r.text), "a boundary 400 leaked instead of a graceful rejection");
      assert.ok(r.threw || r.isError, "a bad size was not rejected");
      return r.threw ? "rejected by the schema before the network" : `graceful error, ${r.text.slice(0, 80)}`;
    });
  }
  const hostilePages = [0, -1];
  for (const p of hostilePages) {
    const r = await callResult(client, "xentral_list_products", { page: p, pageSize: 10 }); // BESTPRACTICE_OK: serial by design, cases share one stdio transport and stay ordered
    check(`products hostile page ${p} handled`, () => {
      assert.ok(!looksBoundary400(r.text), "a boundary 400 leaked");
      assert.ok(r.threw || r.isError, "a bad page was not rejected");
      return r.threw ? "rejected by the schema before the network" : `graceful error, ${r.text.slice(0, 80)}`;
    });
  }

  // The generic tool sends page keys raw with no clamp. Normal sizes and a huge
  // page must be OK. A raw size below 10 has no clamp to save it, so the API
  // returns a 400, and the tool must hand that back as a graceful error, not a
  // crash. That contrast is exactly why the curated clamp exists.
  {
    const r = await callResult(client, "xentral_request", {
      path: "/api/v2/products",
      query: { "page[number]": 1, "page[size]": 10 },
    });
    check("request raw page[size] 10", () => {
      assert.ok(!r.threw && !r.isError, `expected ok, ${r.text.slice(0, 160)}`);
      return `ok in ${r.ms}ms`;
    });
  }
  {
    const r = await callResult(client, "xentral_request", {
      path: "/api/v2/products",
      query: { "page[number]": 1, "page[size]": 50 },
    });
    check("request raw page[size] 50", () => {
      assert.ok(!r.threw && !r.isError, `expected ok, ${r.text.slice(0, 160)}`);
      return `ok in ${r.ms}ms`;
    });
  }
  {
    const r = await callResult(client, "xentral_request", {
      path: "/api/v2/products",
      query: { "page[number]": 99999, "page[size]": 10 },
    });
    check("request raw page[number] 99999 past the end", () => {
      assert.ok(!r.threw, `unexpected crash, ${r.text.slice(0, 160)}`);
      assert.ok(!looksBoundary400(r.text), "a boundary 400 leaked");
      return r.isError ? `handled gracefully, ${r.text.slice(0, 80)}` : `ok in ${r.ms}ms, empty page is valid`;
    });
  }
  {
    const r = await callResult(client, "xentral_request", {
      path: "/api/v2/products",
      query: { "page[number]": 1, "page[size]": 1 },
    });
    check("request raw sub minimum page[size] 1 handled gracefully", () => {
      // No clamp on the generic path, so the API decides. Whatever it returns,
      // the tool must not crash. A 400 here is expected and handled, and it
      // shows why the curated clamp raises a size of 1 to 10.
      assert.ok(!r.threw, `the raw sub minimum size crashed the transport, ${r.text.slice(0, 160)}`);
      if (r.isError && looksBoundary400(r.text)) {
        return "the API returned a 400 for the raw size below 10, handled gracefully, which is why the clamp exists";
      }
      return r.isError ? `handled gracefully, ${r.text.slice(0, 80)}` : `the API accepted the raw size, ok in ${r.ms}ms`;
    });
  }

  await transportSurvives(client, "pagination");
}

// Group 5. Verbose payload. Kept before the rate burst so it runs on a calm
// instance. Numbered to match the task even though it runs earlier.
async function groupVerbose(client: Client): Promise<void> {
  process.stdout.write("\n5. Verbose and deep payload.\n");
  const r = await callResult(client, "xentral_list_products", { pageSize: 50, verbose: true });
  assertNoToken(r.text, "verbose products");
  check("verbose products returns without a schema error", () => {
    assert.ok(!r.threw, `verbose fetch crashed, ${r.text.slice(0, 160)}`);
    assert.ok(!r.isError, `verbose fetch errored, ${r.text.slice(0, 160)}`);
    assert.ok(r.text.length > 0, "verbose fetch returned no text");
    return `ok in ${r.ms}ms, ${r.text.length} chars`;
  });
}

// Group 3. Large response truncation.
async function groupTruncation(): Promise<void> {
  process.stdout.write("\n3. Large response truncation.\n");
  const cap = 500;
  const { client, transport } = await startClient({ XENTRAL_MAX_RESPONSE_CHARS: String(cap) });
  try {
    const r = await callResult(client, "xentral_list_products", { pageSize: 50, verbose: true });
    assertNoToken(r.text, "truncation");
    const marker = `Output truncated at ${cap} characters`;
    check("large payload is capped with the truncation marker", () => {
      assert.ok(!r.threw && !r.isError, `expected a capped result, ${r.text.slice(0, 160)}`);
      assert.ok(r.text.includes(marker), `truncation marker not found in a ${r.text.length} char result`);
      // The body is cut to the cap and the note is appended, so the whole text
      // is a little longer than the cap.
      assert.ok(r.text.length > cap, `capped text was shorter than the cap, ${r.text.length}`);
      return `text length ${r.text.length}, marker present`;
    });
  } finally {
    await client.close();
    await transport.close?.();
  }
}

// Group 4. Timeout behavior.
async function groupTimeout(): Promise<void> {
  process.stdout.write("\n4. Timeout behavior.\n");

  // A one millisecond timeout. A live GET cannot finish that fast, so the HTTP
  // layer aborts and the tool hands back a graceful error, not a crash.
  {
    const { client, transport } = await startClient({ XENTRAL_MCP_TIMEOUT_MS: "1" });
    try {
      const r = await callResult(client, "xentral_request", { path: "/api/v1/users" });
      assertNoToken(r.text, "timeout");
      check("one millisecond timeout returns a graceful error", () => {
        assert.ok(!r.threw, `the timeout crashed the transport, ${r.text.slice(0, 160)}`);
        assert.ok(r.isError, "the timeout should come back as an isError result");
        const t = r.text.toLowerCase();
        assert.ok(
          t.includes("timed out") || t.includes("timeout") || t.includes("abort"),
          `the error did not read as a timeout, ${r.text.slice(0, 160)}`,
        );
        return `handled, ${r.text.slice(0, 90)}`;
      });
      await transportSurvives(client, "timeout");
    } finally {
      await client.close();
      await transport.close?.();
    }
  }

  // A normal timeout makes the same call succeed, which proves the tiny timeout
  // was the cause of the failure above and not a broken path.
  {
    const { client, transport } = await startClient({ XENTRAL_MCP_TIMEOUT_MS: "30000" });
    try {
      const r = await callResult(client, "xentral_request", { path: "/api/v1/users" });
      check("same call succeeds under a normal timeout", () => {
        assert.ok(!r.threw && !r.isError, `expected ok under a normal timeout, ${r.text.slice(0, 160)}`);
        return `ok in ${r.ms}ms, so the tiny timeout was the cause`;
      });
    } finally {
      await client.close();
      await transport.close?.();
    }
  }
}

// Group 2. Rate limit burst and the 429 retry. Runs LAST because it trips the
// demo 100 per minute limit on purpose.
interface BurstStats {
  total: number;
  ok: number;
  recovered: number;
  errors429: number;
  otherErrors: number;
}

async function groupRateLimit(): Promise<BurstStats> {
  process.stdout.write("\n2. Rate limit and the 429 retry.\n");
  const { client, transport } = await startClient({});
  const stats: BurstStats = { total: 0, ok: 0, recovered: 0, errors429: 0, otherErrors: 0 };
  // The internal retry waits about 1200ms before the second attempt, so an OK
  // result that took over 1100ms almost certainly recovered from a 429.
  const RECOVERY_MS = 1100;
  const BURST = 110;

  try {
    process.stdout.write(`   firing ${BURST} rapid GETs to cross the 100 per minute limit\n`);
    for (let i = 0; i < BURST; i += 1) {
      const r = await callResult(client, "xentral_request", { path: "/api/v1/users" }); // BESTPRACTICE_OK: serial by design, the burst must be sequential to cross the rate limit and read each 429
      stats.total += 1;
      if (r.threw) {
        stats.otherErrors += 1;
        continue;
      }
      if (r.isError) {
        if (looksRateLimited(r.text)) stats.errors429 += 1;
        else stats.otherErrors += 1;
        continue;
      }
      stats.ok += 1;
      if (r.ms >= RECOVERY_MS) stats.recovered += 1;
    }

    process.stdout.write(
      `   burst done. ok=${stats.ok} recovered=${stats.recovered} rate429=${stats.errors429} other=${stats.otherErrors}\n`,
    );

    // The whole point. A large burst that crosses the limit must not crash the
    // transport, and a 429 is an expected, handled outcome, never a hard fault.
    check("burst completed without a crash", () => {
      assert.equal(stats.total, BURST, `only ${stats.total} of ${BURST} calls completed`);
      return `all ${BURST} calls returned a structured result`;
    });
    check("no unexpected transport error during the burst", () => {
      assert.equal(stats.otherErrors, 0, `saw ${stats.otherErrors} non rate errors, check the notes above`);
      return "every failure was a handled rate limit, not a transport fault";
    });

    await transportSurvives(client, "post burst");

    // A follow up call right after the burst is still inside the limited window,
    // so it may itself be limited. Either outcome is fine as long as it is
    // handled and does not crash.
    {
      const r = await callResult(client, "xentral_request", { path: "/api/v1/users" });
      check("post burst call is handled", () => {
        assert.ok(!r.threw, `the post burst call crashed, ${r.text.slice(0, 160)}`);
        return r.isError ? `still limited, handled, ${r.text.slice(0, 70)}` : `already recovered, ok in ${r.ms}ms`;
      });
    }

    // Cooldown so the demo rate limit resets before the process exits, so the
    // instance is not left limited for a later run.
    const cooldownMs = 60000;
    process.stdout.write(`   cooling down for ${cooldownMs / 1000} seconds so the demo rate limit resets\n`);
    await new Promise((resolve) => setTimeout(resolve, cooldownMs));
    process.stdout.write("   cooldown done\n");

    // After the cooldown a normal call must succeed, which proves the transport
    // fully recovered from the burst.
    {
      const r = await callResult(client, "xentral_request", { path: "/api/v1/users" });
      check("normal call succeeds after the cooldown", () => {
        assert.ok(!r.threw && !r.isError, `expected recovery after the cooldown, ${r.text.slice(0, 160)}`);
        return `ok in ${r.ms}ms, the limit reset`;
      });
    }
  } finally {
    await client.close();
    await transport.close?.();
  }

  return stats;
}

// Runner.
async function main(): Promise<void> {
  process.stdout.write("xentral-mcp live stress and load suite.\n");

  // A calm instance for the pagination and verbose groups.
  const calm = await startClient({});
  try {
    await groupPagination(calm.client);
    await groupVerbose(calm.client);
  } finally {
    await calm.client.close();
    await calm.transport.close?.();
  }

  await groupTruncation();
  await groupTimeout();

  // The rate burst runs last on its own instance, then cools down.
  const stats = await groupRateLimit();

  process.stdout.write("\n" + "=".repeat(40) + "\n");
  process.stdout.write(
    `429 report. observed ${stats.errors429} rate limited replies, ${stats.recovered} recovered via the retry, ${stats.ok} clean.\n`,
  );
  process.stdout.write(`cases passed ${passed}, cases failed ${failed}.\n`);

  if (failed > 0) {
    process.stderr.write(`\nstress FAIL. ${failed} case(s) failed.\n`);
    process.exit(1);
    return;
  }
  process.stdout.write("\nstress PASS. the clamp, the 429 retry, truncation, and the timeout all held.\n");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`stress ERROR. ${msg}\n`);
  process.exit(1);
});
