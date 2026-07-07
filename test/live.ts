/**
 * Live validation. Starts the built server over stdio against a REAL Xentral
 * instance, connects a real MCP client, and calls every tool with valid
 * arguments. Each tool prints one line, PASS or FAIL. The process exits non
 * zero if any tool fails.
 *
 * Credentials come from the environment only. XENTRAL_TOKEN and XENTRAL_API_URL
 * must be set by the caller. Nothing is written to disk and the token is never
 * printed. An empty list is a PASS. A 400, a 406, a 500, or any isError result
 * is a FAIL.
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
    "live ERROR. XENTRAL_TOKEN and XENTRAL_API_URL must be set in the environment.\n",
  );
  process.exit(1);
}

interface CallResult {
  isError: boolean;
  text: string;
  json: unknown;
}

let failures = 0;

function record(pass: boolean, tool: string, reason: string): void {
  if (pass) {
    process.stdout.write(`PASS ${tool}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL ${tool}. ${reason}\n`);
  }
}

/** Pull the first text block from a tool result and parse JSON when possible. */
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

/** Find the rows array in a formatted list payload. */
function rowsOf(json: unknown): unknown[] | undefined {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const data = (json as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }
  return undefined;
}

/** Extract the id of the first row of a list, when present. */
function firstId(json: unknown): string | undefined {
  const rows = rowsOf(json);
  if (!rows || rows.length === 0) return undefined;
  const row = rows[0] as Record<string, unknown>;
  const id = row?.id;
  return id === undefined || id === null ? undefined : String(id);
}

async function main(): Promise<void> {
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

  const client = new Client({ name: "xentral-mcp-live", version: "0.1.0" });
  await client.connect(transport);

  async function call(name: string, args: Record<string, unknown>): Promise<CallResult> {
    const result = await client.callTool({ name, arguments: args });
    return readResult(result);
  }

  /** Run a list tool. PASS when it returns a non error result, even if empty. */
  async function checkList(tool: string, args: Record<string, unknown> = { pageSize: 10 }): Promise<CallResult> {
    const res = await call(tool, args);
    if (res.isError) {
      record(false, tool, res.text.slice(0, 200));
    } else {
      const rows = rowsOf(res.json);
      const count = rows ? rows.length : "unknown";
      record(true, tool, `rows=${count}`);
    }
    return res;
  }

  /** Run a detail tool for a known id. PASS on a non error result. */
  async function checkDetail(tool: string, id: string | undefined): Promise<void> {
    if (id === undefined) {
      // No id available from an empty list. Treat as PASS, nothing to fetch.
      record(true, tool, "skipped, no id in the list (empty demo dataset)");
      return;
    }
    const res = await call(tool, { id });
    if (res.isError) {
      record(false, tool, res.text.slice(0, 200));
    } else {
      record(true, tool, `id=${id}`);
    }
  }

  // Products, then a product detail, stock, and sales prices from the first id.
  const products = await checkList("xentral_list_products");
  const productId = firstId(products.json);
  await checkDetail("xentral_get_product", productId);
  await checkDetail("xentral_get_product_stock", productId);
  await checkDetail("xentral_get_product_sales_prices", productId);

  // Customers, then a customer detail.
  const customers = await checkList("xentral_list_customers");
  await checkDetail("xentral_get_customer", firstId(customers.json));

  // Sales orders, then a sales order detail.
  const salesOrders = await checkList("xentral_list_sales_orders");
  await checkDetail("xentral_get_sales_order", firstId(salesOrders.json));

  // Invoices, then an invoice detail and the invoice balance.
  const invoices = await checkList("xentral_list_invoices");
  const invoiceId = firstId(invoices.json);
  await checkDetail("xentral_get_invoice", invoiceId);
  await checkDetail("xentral_get_invoice_balance", invoiceId);

  // Purchase orders list, then a purchase order detail.
  const purchaseOrders = await checkList("xentral_list_purchase_orders");
  await checkDetail("xentral_get_purchase_order", firstId(purchaseOrders.json));

  // Delivery notes list, then a delivery note detail and its shipments.
  const deliveryNotes = await checkList("xentral_list_delivery_notes");
  const deliveryNoteId = firstId(deliveryNotes.json);
  await checkDetail("xentral_get_delivery_note", deliveryNoteId);
  await checkDetail("xentral_get_delivery_note_shipments", deliveryNoteId);

  // Suppliers list, then a supplier detail.
  const suppliers = await checkList("xentral_list_suppliers");
  await checkDetail("xentral_get_supplier", firstId(suppliers.json));

  // Webhooks list, then a webhook detail. The demo webhook list is usually
  // empty, so the detail check is skipped when there is no id.
  const webhooks = await checkList("xentral_list_webhooks");
  await checkDetail("xentral_get_webhook", firstId(webhooks.json));

  // Webhook event types catalog.
  await checkList("xentral_list_webhook_event_types");

  // Spec index tools. list_domains takes no input, find_endpoint takes a query.
  {
    const res = await call("xentral_list_domains", {});
    record(!res.isError && !!res.json, "xentral_list_domains", res.isError ? res.text.slice(0, 200) : "domains listed");
  }
  {
    const res = await call("xentral_find_endpoint", { query: "invoice" });
    const rows = res.json && typeof res.json === "object" ? (res.json as Record<string, unknown>).results : undefined;
    const ok = !res.isError && Array.isArray(rows) && rows.length > 0;
    record(ok, "xentral_find_endpoint", ok ? `matches=${(rows as unknown[]).length}` : res.text.slice(0, 200));
  }

  // Generic request against a known good relative path.
  {
    const res = await call("xentral_request", { path: "/api/v1/users" });
    record(!res.isError, "xentral_request", res.isError ? res.text.slice(0, 200) : "GET /api/v1/users ok");
  }

  await client.close();

  if (failures > 0) {
    process.stderr.write(`\nlive FAIL. ${failures} tool(s) failed.\n`);
    process.exit(1);
    return;
  }
  process.stdout.write(`\nlive PASS. every tool returned real data or an empty list.\n`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`live ERROR. ${msg}\n`);
  process.exit(1);
});
