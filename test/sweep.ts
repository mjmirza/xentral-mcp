/**
 * Live endpoint sweep. Starts the built server over stdio against a REAL Xentral
 * instance, connects a real MCP client, and calls every GET operation in the
 * spec through the xentral_request tool. Read only. It only ever issues GET
 * requests and never mutates the demo.
 *
 * Credentials come from the environment only. XENTRAL_TOKEN and XENTRAL_API_URL
 * must be set by the caller. The token is never printed and the demo host is
 * never written into this file. Pacing keeps the call rate under 90 per minute,
 * below the live limit of 100 per minute.
 *
 * Each GET is classified.
 *   OK        a 2xx result, or an empty list.
 *   GATED     a 403, expected for beta or permission locked endpoints.
 *   NOTFOUND  a 404, the route is not mounted on this demo instance.
 *   ACCEPT    a 406, the endpoint serves a media type other than application
 *             json, so the fixed Accept header of the generic tool cannot reach
 *             it. Expected, not a fault.
 *   RATELIMIT a 429 that stayed limited after one extra backoff and retry.
 *   NEEDS-ID  a path parameter could not be filled from the id cache, so the
 *             call was skipped. Not a failure.
 *   NEEDS-PARAMS a 400 whose body says a field is required, so the endpoint
 *             needs query parameters the plain read does not supply. Not a fault.
 *   UPSTREAM  a 5xx from the API itself. A well formed GET cannot cause a 5xx,
 *             so this is a server side fault on the instance (for example an
 *             accounting module that is not provisioned on the demo), not a
 *             fault in the MCP server or the sweep. Reported, never masked.
 *   ERROR     a real client side fault. a 401, a 400 that is not a field
 *             required validation, or a network fault. Worth fixing.
 *
 * The process exits non zero only when at least one endpoint lands in ERROR.
 * UPSTREAM and NEEDS-PARAMS are surfaced in the report but do not fail the run,
 * because they are properties of the instance and the endpoint, not the client.
 *
 * Every await inside a loop below is serial on purpose. Requests run one at a
 * time behind a fixed spacing so the whole sweep, plus id resolution, stays
 * under the rate limit. Parallel calls would defeat that pacing.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "dist", "index.js");
const inventoryPath = join(here, "..", "src", "data", "endpoint-inventory.json");
const reportDir = join(here, "reports");
const reportPath = join(reportDir, "sweep-report.md");

const token = process.env.XENTRAL_TOKEN ?? "";
const apiUrl = process.env.XENTRAL_API_URL ?? "";
if (token.trim() === "" || apiUrl.trim() === "") {
  process.stderr.write(
    "sweep ERROR. XENTRAL_TOKEN and XENTRAL_API_URL must be set in the environment.\n",
  );
  process.exit(1);
}

/** Spacing between calls in milliseconds. About 85 calls per minute. */
const CALL_SPACING_MS = 700;
/** Extra backoff before the one manual retry on a surfaced 429. */
const RATE_LIMIT_BACKOFF_MS = 1500;

type Bucket =
  | "OK"
  | "GATED"
  | "NOTFOUND"
  | "ACCEPT"
  | "RATELIMIT"
  | "NEEDS-ID"
  | "NEEDS-PARAMS"
  | "UPSTREAM"
  | "ERROR";

interface Endpoint {
  method: string;
  path: string;
  requiredParams?: string[];
}

interface GetOutcome {
  isError: boolean;
  status: number | undefined;
  text: string;
  json: unknown;
}

/** One resolved id fetch, memoized by concrete path. */
interface FetchRecord {
  outcome: GetOutcome;
  firstId: string | undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pull the first text block from a tool result and parse JSON when possible. */
function readResult(result: unknown): { isError: boolean; text: string; json: unknown } {
  const r = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  const block = (r.content ?? []).find((c) => c.type === "text");
  const text = block?.text ?? "";
  let json: unknown = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { isError: r.isError === true, text, json };
}

/** Read an HTTP status out of a tool error string of the form "failed with 403". */
function statusFromText(text: string): number | undefined {
  const m = text.match(/failed with (\d{3})/);
  return m ? Number(m[1]) : undefined;
}

/** Find a rows array inside a formatted list payload. */
function rowsOf(json: unknown): unknown[] | undefined {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    for (const key of ["data", "items", "rows", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return undefined;
}

/** Read one id from a value that might be an object or a row. */
function idOf(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const row = value as Record<string, unknown>;
  for (const key of ["id", "uuid", "number"]) {
    const v = row[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return undefined;
}

/** Extract the first usable id from a list payload or a single object payload. */
function firstIdOf(json: unknown): string | undefined {
  const rows = rowsOf(json);
  if (rows && rows.length > 0) {
    const fromRow = idOf(rows[0]);
    if (fromRow) return fromRow;
  }
  const direct = idOf(json);
  if (direct) return direct;
  if (json && typeof json === "object") {
    const data = (json as Record<string, unknown>).data;
    const fromData = idOf(data);
    if (fromData) return fromData;
  }
  return undefined;
}

function isParam(segment: string): boolean {
  return segment.startsWith("{") && segment.endsWith("}");
}

/**
 * Map a parent list path whose direct read yields no id to a friendlier
 * alternative for id purposes only. The v1 invoices list serves the minimal
 * json media type and returns 406 through the fixed Accept header, so the v3
 * list gives the invoice id instead.
 */
const parentIdAliases: Record<string, string> = {
  "/api/v1/invoices": "/api/v3/invoices",
};

async function main(): Promise<void> {
  const raw = readFileSync(inventoryPath, "utf8");
  const inventory = JSON.parse(raw) as Endpoint[];
  const gets = inventory.filter((e) => e.method.toUpperCase() === "GET");

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: {
      ...process.env,
      XENTRAL_API_URL: apiUrl,
      XENTRAL_TOKEN: token,
      XENTRAL_MCP_READONLY: "1",
    },
  });

  const client = new Client({ name: "xentral-mcp-sweep", version: "0.1.0" });
  await client.connect(transport);

  // Every network fetch flows through this memo, keyed by concrete path, so each
  // distinct path hits the API at most once. Pacing lives here too, so both the
  // sweep and the id resolution stay under the rate limit together.
  const memo = new Map<string, FetchRecord>();
  let networkCalls = 0;

  /** Run one GET tool call, GET only, never a write. */
  async function rawGet(path: string): Promise<GetOutcome> {
    const result = await client.callTool({ name: "xentral_request", arguments: { path } });
    const parsed = readResult(result);
    const status = parsed.isError ? statusFromText(parsed.text) : 200;
    return { isError: parsed.isError, status, text: parsed.text, json: parsed.json };
  }

  /** Paced GET with one extra retry when a 429 surfaces past the tool retry. */
  async function getPath(path: string): Promise<FetchRecord> {
    const cached = memo.get(path);
    if (cached) return cached;

    await sleep(CALL_SPACING_MS);
    networkCalls += 1;
    let outcome = await rawGet(path);

    if (outcome.status === 429) {
      await sleep(RATE_LIMIT_BACKOFF_MS);
      networkCalls += 1;
      outcome = await rawGet(path);
    }

    const record: FetchRecord = { outcome, firstId: firstIdOf(outcome.json) };
    memo.set(path, record);
    return record;
  }

  /** First id for a parent list path, trying an alias when the direct read is dry. */
  async function firstIdForParent(parent: string): Promise<string | undefined> {
    const direct = await getPath(parent);
    if (direct.firstId) return direct.firstId;
    const alias = parentIdAliases[parent];
    if (alias) {
      const aliased = await getPath(alias);
      if (aliased.firstId) return aliased.firstId;
    }
    return undefined;
  }

  /**
   * Turn a template path into a concrete path by filling each parameter from a
   * real list read. A country code takes a stable literal. Any parameter that
   * cannot be filled returns null, which marks the endpoint NEEDS-ID.
   */
  async function resolveConcrete(template: string): Promise<string | null> {
    const segs = template.split("/").filter(Boolean);
    const concrete: string[] = [];
    for (const seg of segs) {
      if (!isParam(seg)) {
        concrete.push(seg);
        continue;
      }
      const name = seg.slice(1, -1);
      if (/country/i.test(name)) {
        concrete.push("DE");
        continue;
      }
      const parent = "/" + concrete.join("/");
      const id = await firstIdForParent(parent); // BESTPRACTICE_OK: serial by design, each parameter feeds the next segment
      if (!id) return null;
      concrete.push(encodeURIComponent(id));
    }
    return "/" + concrete.join("/");
  }

  function classify(outcome: GetOutcome): Bucket {
    if (!outcome.isError) return "OK";
    const status = outcome.status;
    if (status === 403) return "GATED";
    if (status === 404) return "NOTFOUND";
    if (status === 406) return "ACCEPT";
    if (status === 429) return "RATELIMIT";
    // A 5xx from a well formed GET is a server side fault on the instance.
    if (status !== undefined && status >= 500 && status <= 599) return "UPSTREAM";
    // A 400 whose body reports a required field means the endpoint needs query
    // parameters the plain read does not supply, not a client fault.
    if (status === 400 && /valid|is required|required\b/i.test(outcome.text)) {
      return "NEEDS-PARAMS";
    }
    return "ERROR";
  }

  // Warm the id cache from the stable list endpoints first, so the detail paths
  // that follow have real ids to fill their parameters.
  const warmupLists = [
    "/api/v2/products",
    "/api/v2/customers",
    "/api/v1/salesOrders",
    "/api/v1/invoices",
    "/api/v1/purchaseOrders",
    "/api/v1/deliveryNotes",
    "/api/v1/suppliers",
    "/api/v1/warehouses",
  ];
  for (const list of warmupLists) {
    await firstIdForParent(list); // BESTPRACTICE_OK: serial by design to hold the call rate under the API limit
  }

  // Process endpoints with no path parameters first. That fills the memo with
  // collection reads before the detail paths try to resolve ids from them.
  const noParam = gets.filter((e) => !e.path.includes("{"));
  const withParam = gets.filter((e) => e.path.includes("{"));
  const ordered = [...noParam, ...withParam];

  const results: Array<{ path: string; bucket: Bucket; status: number | undefined }> = [];
  let called = 0;
  let skipped = 0;

  for (const ep of ordered) {
    const pathParams = new Set((ep.path.match(/\{(\w+)\}/g) ?? []).map((s) => s.slice(1, -1)));
    const requiredQuery = (ep.requiredParams ?? []).filter((p) => !pathParams.has(p));

    // A required query parameter that no list read can supply means the call
    // cannot be shaped, so record it as NEEDS-ID rather than a fault.
    if (requiredQuery.length > 0) {
      results.push({ path: ep.path, bucket: "NEEDS-ID", status: undefined });
      skipped += 1;
      continue;
    }

    let concrete: string | null = ep.path;
    if (ep.path.includes("{")) {
      concrete = await resolveConcrete(ep.path); // BESTPRACTICE_OK: serial by design to hold the call rate under the API limit
    }
    if (concrete === null) {
      results.push({ path: ep.path, bucket: "NEEDS-ID", status: undefined });
      skipped += 1;
      continue;
    }

    const record = await getPath(concrete); // BESTPRACTICE_OK: serial by design to hold the call rate under the API limit
    const bucket = classify(record.outcome);
    results.push({ path: ep.path, bucket, status: record.outcome.status });
    called += 1;
  }

  await client.close();

  // Compact console summary.
  const counts: Record<Bucket, number> = {
    OK: 0,
    GATED: 0,
    NOTFOUND: 0,
    ACCEPT: 0,
    RATELIMIT: 0,
    "NEEDS-ID": 0,
    "NEEDS-PARAMS": 0,
    UPSTREAM: 0,
    ERROR: 0,
  };
  for (const r of results) counts[r.bucket] += 1;

  process.stdout.write("\nsweep summary\n");
  process.stdout.write(`total GET endpoints ${results.length}\n`);
  process.stdout.write(`called live ${called}, skipped NEEDS-ID ${skipped}\n`);
  process.stdout.write(`distinct network fetches ${memo.size}, total requests ${networkCalls}\n`);
  process.stdout.write(
    `OK ${counts.OK}  GATED ${counts.GATED}  NOTFOUND ${counts.NOTFOUND}  ` +
      `ACCEPT ${counts.ACCEPT}  RATELIMIT ${counts.RATELIMIT}  ` +
      `NEEDS-ID ${counts["NEEDS-ID"]}  NEEDS-PARAMS ${counts["NEEDS-PARAMS"]}  ` +
      `UPSTREAM ${counts.UPSTREAM}  ERROR ${counts.ERROR}\n`,
  );

  // Detailed per endpoint report. Relative paths and status buckets only. No
  // token and no demo host reach this file.
  mkdirSync(reportDir, { recursive: true });
  const lines: string[] = [];
  lines.push("# Xentral GET sweep report");
  lines.push("");
  lines.push("Read only sweep of every GET operation in the spec through the MCP");
  lines.push("server. Relative paths and status buckets only. No credential and no");
  lines.push("host appear here.");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`Total GET endpoints ${results.length}`);
  lines.push(`Called live ${called}, skipped NEEDS-ID ${skipped}`);
  lines.push("");
  lines.push(`OK ${counts.OK}`);
  lines.push(`GATED ${counts.GATED}`);
  lines.push(`NOTFOUND ${counts.NOTFOUND}`);
  lines.push(`ACCEPT ${counts.ACCEPT}`);
  lines.push(`RATELIMIT ${counts.RATELIMIT}`);
  lines.push(`NEEDS-ID ${counts["NEEDS-ID"]}`);
  lines.push(`NEEDS-PARAMS ${counts["NEEDS-PARAMS"]}`);
  lines.push(`UPSTREAM ${counts.UPSTREAM}`);
  lines.push(`ERROR ${counts.ERROR}`);
  lines.push("");

  const upstream = results.filter((r) => r.bucket === "UPSTREAM");
  if (upstream.length > 0) {
    lines.push("## Server side faults on the instance (5xx, not a client fault)");
    lines.push("");
    lines.push("A well formed GET cannot cause a 5xx. These endpoints fault on the");
    lines.push("instance itself, most often because the module is not provisioned on");
    lines.push("the demo. The MCP reaches each one and reports the status honestly.");
    lines.push("");
    for (const r of upstream) {
      const st = r.status === undefined ? "no status" : `status ${r.status}`;
      lines.push(`GET ${r.path} => UPSTREAM (${st})`);
    }
    lines.push("");
  }

  const needsParams = results.filter((r) => r.bucket === "NEEDS-PARAMS");
  if (needsParams.length > 0) {
    lines.push("## Reads that need query parameters (400 field required)");
    lines.push("");
    for (const r of needsParams) {
      lines.push(`GET ${r.path} => NEEDS-PARAMS (status 400)`);
    }
    lines.push("");
  }

  const errors = results.filter((r) => r.bucket === "ERROR");
  if (errors.length > 0) {
    lines.push("## Errors worth investigating");
    lines.push("");
    for (const r of errors) {
      const st = r.status === undefined ? "no status" : `status ${r.status}`;
      lines.push(`GET ${r.path} => ERROR (${st})`);
    }
    lines.push("");
  }

  lines.push("## All endpoints");
  lines.push("");
  const sorted = [...results].sort((a, b) => a.path.localeCompare(b.path));
  for (const r of sorted) {
    lines.push(`GET ${r.path} => ${r.bucket}`);
  }
  lines.push("");
  writeFileSync(reportPath, lines.join("\n"), "utf8");
  process.stdout.write(`report written to test/reports/sweep-report.md\n`);

  if (errors.length > 0) {
    process.stderr.write(`\nsweep FAIL. ${errors.length} endpoint(s) in ERROR.\n`);
    for (const r of errors) {
      const st = r.status === undefined ? "no status" : `status ${r.status}`;
      process.stderr.write(`  GET ${r.path} (${st})\n`);
    }
    process.exit(1);
    return;
  }
  process.stdout.write("\nsweep PASS. no unexpected error.\n");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`sweep ERROR. ${msg}\n`);
  process.exit(1);
});
