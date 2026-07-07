/**
 * Live guarded-write proof. This does NOT replace test/live.ts. It proves two
 * things about the guarded generic tool (xentral_request), live against a REAL
 * Xentral instance.
 *
 * Phase A. With the read-only default, a POST is REFUSED by the local guard
 * before it reaches the API, and no webhook is created.
 *
 * Phase B. With XENTRAL_MCP_READONLY=false, a mutation LEAVES the guard and
 * reaches the API. It first tries a PATCH on the sales-order logActivity action
 * (a non-creating, non-destructive log entry). If that route is not mounted on
 * the instance (a 404 route-not-found), it falls back to a real
 * POST /api/v1/webhooks create, confirms the webhook exists, DELETEs it with
 * XENTRAL_MCP_ALLOW_DELETE=true, and confirms it is gone. Either way the guard
 * opened the write path.
 *
 * Credentials come from the environment only. XENTRAL_TOKEN and XENTRAL_API_URL
 * must be set. Nothing is written to disk and the token is never printed.
 */

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
    "live-write ERROR. XENTRAL_TOKEN and XENTRAL_API_URL must be set in the environment.\n",
  );
  process.exit(1);
}

const MARKER = `mcp-live-write-${Date.now()}`;

interface CallResult {
  isError: boolean;
  text: string;
  json: unknown;
}

let failures = 0;

function record(pass: boolean, label: string, reason: string): void {
  if (pass) {
    process.stdout.write(`PASS ${label}. ${reason}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL ${label}. ${reason}\n`);
  }
}

function readResult(result: unknown): CallResult {
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

/** Rows of a formatted list payload. */
function rowsOf(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) return json as Array<Record<string, unknown>>;
  if (json && typeof json === "object") {
    const data = (json as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  }
  return [];
}

/** Start one stdio server session with the given extra env, run fn, then close. */
async function withSession(
  extraEnv: Record<string, string>,
  fn: (call: (name: string, args: Record<string, unknown>) => Promise<CallResult>) => Promise<void>,
): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: {
      ...process.env,
      XENTRAL_API_URL: apiUrl,
      XENTRAL_TOKEN: token,
      ...extraEnv,
    },
  });
  const client = new Client({ name: "xentral-mcp-live-write", version: "0.1.0" });
  await client.connect(transport);
  try {
    const call = async (name: string, args: Record<string, unknown>): Promise<CallResult> =>
      readResult(await client.callTool({ name, arguments: args }));
    await fn(call);
  } finally {
    await client.close();
  }
}

/** A valid webhook create body. Verified against the live create schema. */
function webhookBody(): Record<string, unknown> {
  return {
    name: MARKER,
    url: "https://example.com/mcp-live-write",
    signatureKey: "mcp-live-write-signature-key",
    events: [{ id: "com.xentral.autoshipment.dispatched.v1" }],
  };
}

/** True when the error text is a real Xentral response, not a local guard or transport failure. */
function reachedApi(res: CallResult): boolean {
  if (!res.isError) return true; // 2xx.
  return /failed with 4\d\d/.test(res.text); // a 4xx from Xentral means the request reached it.
}

/** True when the error is the local read-only guard refusing the method. */
function blockedByGuard(res: CallResult): boolean {
  return res.isError && /not permitted/i.test(res.text) && /read only/i.test(res.text);
}

async function phaseA(): Promise<void> {
  // Read-only default. Leave XENTRAL_MCP_READONLY unset so the true default applies.
  await withSession({}, async (call) => {
    // Count our marker webhooks before (GET is allowed even read-only).
    const before = rowsOf((await call("xentral_list_webhooks", { pageSize: 50 })).json).filter(
      (r) => r.name === MARKER,
    ).length;

    const res = await call("xentral_request", {
      path: "/api/v1/webhooks",
      method: "POST",
      body: webhookBody(),
    });

    const guarded = blockedByGuard(res);
    record(guarded, "phaseA guard refuses POST", guarded ? res.text.slice(0, 140) : `unexpected. ${res.text.slice(0, 200)}`);

    const after = rowsOf((await call("xentral_list_webhooks", { pageSize: 50 })).json).filter(
      (r) => r.name === MARKER,
    ).length;
    const noCreate = before === after && after === 0;
    record(noCreate, "phaseA no webhook created", `marker count before=${before} after=${after}`);
  });
}

async function phaseB(): Promise<void> {
  // Writes enabled, plus the extra delete opt-in for the fallback cleanup.
  await withSession({ XENTRAL_MCP_READONLY: "false", XENTRAL_MCP_ALLOW_DELETE: "true" }, async (call) => {
    // Primary. A non-creating logActivity PATCH on a real sales order.
    const soRes = await call("xentral_request", { path: "/api/v3/salesOrders", query: { perPage: 1 } });
    const soId = rowsOf(soRes.json)[0]?.id;

    let primaryDone = false;
    if (soId !== undefined && soId !== null) {
      const patch = await call("xentral_request", {
        path: `/api/v3/salesOrders/${String(soId)}/actions/logActivity`,
        method: "PATCH",
        body: { name: MARKER, description: "guard proof, no mutation" },
      });

      if (blockedByGuard(patch)) {
        record(false, "phaseB write reaches API", `guard blocked a PATCH while writes are enabled. ${patch.text.slice(0, 160)}`);
        return;
      }
      const notMounted = patch.isError && /failed with 404/.test(patch.text);
      if (!notMounted && reachedApi(patch)) {
        record(true, "phaseB write reaches API (logActivity)", patch.isError ? patch.text.slice(0, 140) : "logActivity accepted (2xx)");
        primaryDone = true;
      }
    }

    if (primaryDone) return;

    // Fallback. A real webhook create, confirm, delete, confirm gone.
    process.stdout.write("phaseB note. logActivity route not mounted on this instance, using the webhook create+delete proof.\n");

    const created = await call("xentral_request", { path: "/api/v1/webhooks", method: "POST", body: webhookBody() });
    if (blockedByGuard(created)) {
      record(false, "phaseB write reaches API (webhook create)", `guard blocked the POST while writes are enabled. ${created.text.slice(0, 160)}`);
      return;
    }
    const createReached = reachedApi(created);
    record(createReached, "phaseB write reaches API (webhook create)", created.isError ? created.text.slice(0, 140) : "webhook created (2xx)");
    if (created.isError) return; // a 4xx reached the API, but there is nothing to clean up.

    // Find the created webhook by its marker name.
    const listed = rowsOf((await call("xentral_list_webhooks", { pageSize: 50 })).json).filter((r) => r.name === MARKER);
    const webhookId = listed[0]?.id;
    record(webhookId !== undefined, "phaseB created webhook is present", webhookId !== undefined ? `id=${String(webhookId)}` : "created webhook not found in the list");
    if (webhookId === undefined) return;

    // Delete it (needs both readonly=false and allowDelete=true, both set on this session).
    const deleted = await call("xentral_request", { path: `/api/v1/webhooks/${String(webhookId)}`, method: "DELETE" });
    record(!deleted.isError, "phaseB delete removes the webhook", deleted.isError ? deleted.text.slice(0, 160) : "delete accepted (2xx)");

    // Confirm it is gone.
    const gone = await call("xentral_request", { path: `/api/v1/webhooks/${String(webhookId)}`, method: "GET" });
    const isGone = gone.isError && /failed with 404/.test(gone.text);
    record(isGone, "phaseB webhook is gone", isGone ? "GET now returns 404" : `unexpected. ${gone.text.slice(0, 160)}`);
  });
}

async function main(): Promise<void> {
  await phaseA();
  await phaseB();

  if (failures > 0) {
    process.stderr.write(`\nlive-write FAIL. ${failures} check(s) failed.\n`);
    process.exit(1);
    return;
  }
  process.stdout.write(`\nlive-write PASS. the guard blocks writes by default and opens them when enabled.\n`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`live-write ERROR. ${msg}\n`);
  process.exit(1);
});
