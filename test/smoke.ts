/**
 * Smoke test. Starts the built server over stdio, lists the tools, and asserts
 * the curated reads, the discovery tools, and the generic request tool are all
 * present. Exits non zero on any failure. No live Xentral call is made.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "dist", "index.js");

const EXPECTED = [
  "xentral_list_products",
  "xentral_get_product",
  "xentral_get_product_stock",
  "xentral_list_customers",
  "xentral_get_customer",
  "xentral_list_sales_orders",
  "xentral_get_sales_order",
  "xentral_list_invoices",
  "xentral_get_invoice",
  "xentral_list_purchase_orders",
  "xentral_list_delivery_notes",
  "xentral_list_suppliers",
  "xentral_get_supplier",
  "xentral_get_purchase_order",
  "xentral_get_delivery_note",
  "xentral_get_delivery_note_shipments",
  "xentral_get_invoice_balance",
  "xentral_get_invoice_documents",
  "xentral_get_product_sales_prices",
  "xentral_list_webhooks",
  "xentral_get_webhook",
  "xentral_list_webhook_event_types",
  "xentral_list_offers",
  "xentral_get_offer",
  "xentral_list_credit_notes",
  "xentral_get_credit_note",
  "xentral_create_sales_order",
  "xentral_release_sales_order",
  "xentral_send_sales_order",
  "xentral_cancel_sales_order",
  "xentral_set_product_stock",
  "xentral_create_shipment",
  "xentral_create_invoice",
  "xentral_create_credit_note",
  "xentral_create_product",
  "xentral_create_customer",
  "xentral_create_purchase_order",
  "xentral_receive_goods",
  "xentral_list_domains",
  "xentral_find_endpoint",
  "xentral_request",
];

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: {
      ...process.env,
      XENTRAL_API_URL: "https://smoke.xentral.biz",
      XENTRAL_TOKEN: "smoke-token-value-not-real",
      XENTRAL_MCP_READONLY: "1",
    },
  });

  const client = new Client({ name: "xentral-mcp-smoke", version: "0.1.0" });
  await client.connect(transport);

  const listed = await client.listTools();
  const names = new Set(listed.tools.map((t) => t.name));

  const missing = EXPECTED.filter((name) => !names.has(name));
  await client.close();

  if (missing.length > 0) {
    process.stderr.write(`smoke FAIL. missing tools. ${missing.join(", ")}\n`);
    process.stderr.write(`smoke found. ${[...names].sort().join(", ")}\n`);
    process.exit(1);
    return;
  }

  process.stdout.write(`smoke PASS. ${names.size} tools registered. all ${EXPECTED.length} expected present.\n`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`smoke ERROR. ${msg}\n`);
  process.exit(1);
});
