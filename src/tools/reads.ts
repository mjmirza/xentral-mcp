/**
 * Curated read tools on the corrected paths from the knowledge base
 * (skills/xentral-api/FLOWS-AND-GAPS.md). Every tool is read only.
 *
 * Path choices, with the source path noted per tool.
 *   products         GET /api/v2/products            (V1 is deprecated, use V2)
 *   product          GET /api/v2/products/{id}
 *   product stock    GET /api/v1/products/{id}/stocks  (per product only, no global list)
 *   customers        GET /api/v2/customers           (V3 list is beta and gated)
 *   customer         GET /api/v2/customers/{id}
 *   sales orders     GET /api/v1/salesOrders         (stable, V3 /api/v3/salesOrders is the newer form)
 *   sales order      GET /api/v1/salesOrders/{id}    (stable, V3 alternative /api/v3/salesOrders/{id})
 *   invoices         GET /api/v1/invoices            (stable, V3 alternative /api/v3/invoices)
 *   invoice          GET /api/v1/invoices/{id}       (stable, V3 alternative /api/v3/invoices/{id})
 *   purchase orders  GET /api/v1/purchaseOrders      (stable, V3 alternative /api/v3/purchaseOrders)
 *   delivery notes   GET /api/v1/deliveryNotes       (NOT /deliveries, that is shipment level)
 *   suppliers        GET /api/v1/suppliers           (V3 list is beta and gated, use V1)
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { xentralRequest, type QueryValue } from "../http.js";
import { formatResponse } from "../format.js";

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_MIN = 10;
const PAGE_SIZE_DEFAULT = 10;
const PAGE_NUMBER_DEFAULT = 1;

/**
 * The V1 and V2 list endpoints require page[number] and page[size] to be sent
 * TOGETHER. Sending one without the other returns a 400. The API also rejects
 * page[size] below 10 with "The page.size must be at least 10.". So the server
 * always emits both keys and clamps the size into the 10 to 50 range. A caller
 * asking for fewer than 10 is silently raised to 10, never rejected.
 */

/** Shared input shape for list tools. */
const listInput = {
  page: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("Page number, starting at 1. Maps to page[number]. Default 1."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .optional()
    .describe(
      `Rows per page. Maps to page[size]. The API accepts ${PAGE_SIZE_MIN} to ${PAGE_SIZE_MAX}. A value below ${PAGE_SIZE_MIN} is silently raised to ${PAGE_SIZE_MIN}. Default ${PAGE_SIZE_DEFAULT}.`,
    ),
  query: z
    .string()
    .optional()
    .describe(
      "Optional free text passed to the API as the search parameter. Best effort. Some endpoints ignore it or reject it with a 400.",
    ),
  verbose: z
    .boolean()
    .optional()
    .describe("When true, return the full payload. When false or absent, strip empty fields to save tokens."),
};

/** Shared input shape for detail tools. */
const detailInput = {
  id: z.string().min(1).describe("The resource id."),
  verbose: z
    .boolean()
    .optional()
    .describe("When true, return the full payload. When false or absent, strip empty fields to save tokens."),
};

type ListArgs = { page?: number; pageSize?: number; query?: string; verbose?: boolean };
type DetailArgs = { id: string; verbose?: boolean };

/** Build V1 and V2 bracket pagination query. Both page[number] and page[size]
 * are always emitted together because the API rejects one without the other,
 * and the size is clamped into the 10 to 50 range the API allows. Filter keys
 * are enumerated per resource in the spec, so a generic filter is not built
 * here. */
function buildListQuery(args: ListArgs): Record<string, QueryValue> {
  const q: Record<string, QueryValue> = {};
  const number = args.page !== undefined && args.page > 0 ? args.page : PAGE_NUMBER_DEFAULT;
  const requested = args.pageSize !== undefined ? args.pageSize : PAGE_SIZE_DEFAULT;
  const size = Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, requested));
  q["page[number]"] = number;
  q["page[size]"] = size;
  if (args.query !== undefined && args.query !== "") q["search"] = args.query;
  return q;
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: `Error. ${message}` }], isError: true };
}

/** Register one list tool at a fixed path. An optional accept overrides the
 * request Accept header for endpoints that do not serve plain application/json
 * (for example the V1 invoices list serves application/vnd.xentral.minimal+json
 * only, so plain application/json returns a 406). */
function registerList(
  server: McpServer,
  cfg: Config,
  name: string,
  title: string,
  description: string,
  path: string,
  accept?: string,
): void {
  server.registerTool(
    name,
    { title, description, inputSchema: listInput },
    async (args: ListArgs) => {
      try {
        const headers = accept ? { Accept: accept } : undefined;
        const res = await xentralRequest(cfg, {
          method: "GET",
          path,
          query: buildListQuery(args),
          headers,
        });
        const verbose = args.verbose ?? false;
        return textResult(formatResponse(res.data, { verbose, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** Register one detail tool at a fixed path template using {id}. */
function registerDetail(
  server: McpServer,
  cfg: Config,
  name: string,
  title: string,
  description: string,
  pathTemplate: string,
): void {
  server.registerTool(
    name,
    { title, description, inputSchema: detailInput },
    async (args: DetailArgs) => {
      try {
        const path = pathTemplate.replace("{id}", encodeURIComponent(args.id));
        const res = await xentralRequest(cfg, { method: "GET", path });
        const verbose = args.verbose ?? false;
        return textResult(formatResponse(res.data, { verbose, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** Register every curated read tool. */
export function registerReadTools(server: McpServer, cfg: Config): void {
  // Products. Source path GET /api/v2/products (V2, V1 deprecated).
  registerList(
    server,
    cfg,
    "xentral_list_products",
    "List products",
    "Read only. List products from GET /api/v2/products. V1 is deprecated, this uses V2. Paginated with page[number] and page[size].",
    "/api/v2/products",
  );
  registerDetail(
    server,
    cfg,
    "xentral_get_product",
    "Get product",
    "Read only. Get one product from GET /api/v2/products/{id}.",
    "/api/v2/products/{id}",
  );

  // Product stock. Source path GET /api/v1/products/{id}/stocks. Per product only.
  server.registerTool(
    "xentral_get_product_stock",
    {
      title: "Get product stock",
      description:
        "Read only. Get stock levels for one product from GET /api/v1/products/{id}/stocks. There is no global stock list in the API. Stock is read per product, so a product id is required.",
      inputSchema: detailInput,
    },
    async (args: DetailArgs) => {
      try {
        const path = `/api/v1/products/${encodeURIComponent(args.id)}/stocks`;
        const res = await xentralRequest(cfg, { method: "GET", path });
        const verbose = args.verbose ?? false;
        return textResult(formatResponse(res.data, { verbose, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // Customers. Source path GET /api/v2/customers (V3 list is beta and gated).
  registerList(
    server,
    cfg,
    "xentral_list_customers",
    "List customers",
    "Read only. List customers from GET /api/v2/customers. The V3 customers list is beta and permission gated, so this uses V2.",
    "/api/v2/customers",
  );
  registerDetail(
    server,
    cfg,
    "xentral_get_customer",
    "Get customer",
    "Read only. Get one customer from GET /api/v2/customers/{id}.",
    "/api/v2/customers/{id}",
  );

  // Sales orders. Source path GET /api/v1/salesOrders (stable). V3 alternative GET /api/v3/salesOrders.
  registerList(
    server,
    cfg,
    "xentral_list_sales_orders",
    "List sales orders",
    "Read only. List sales orders from GET /api/v1/salesOrders (stable). A newer V3 form GET /api/v3/salesOrders exists and uses the V3 pagination family.",
    "/api/v1/salesOrders",
  );
  registerDetail(
    server,
    cfg,
    "xentral_get_sales_order",
    "Get sales order",
    "Read only. Get one sales order from GET /api/v1/salesOrders/{id} (stable). V3 alternative GET /api/v3/salesOrders/{id}.",
    "/api/v1/salesOrders/{id}",
  );

  // Invoices. Source path GET /api/v1/invoices (stable). V3 alternative GET /api/v3/invoices.
  registerList(
    server,
    cfg,
    "xentral_list_invoices",
    "List invoices",
    "Read only. List invoices from GET /api/v1/invoices (stable). This endpoint serves application/vnd.xentral.minimal+json only, so the tool sends that Accept header. Plain application/json returns a 406. V3 alternative GET /api/v3/invoices. For the open amount of one invoice, use xentral_request against /api/v1/invoices/{id}/balance.",
    "/api/v1/invoices",
    "application/vnd.xentral.minimal+json",
  );
  registerDetail(
    server,
    cfg,
    "xentral_get_invoice",
    "Get invoice",
    "Read only. Get one invoice from GET /api/v1/invoices/{id} (stable). V3 alternative GET /api/v3/invoices/{id}.",
    "/api/v1/invoices/{id}",
  );

  // Purchase orders. Source path GET /api/v1/purchaseOrders (stable). V3 alternative GET /api/v3/purchaseOrders.
  registerList(
    server,
    cfg,
    "xentral_list_purchase_orders",
    "List purchase orders",
    "Read only. List purchase orders from GET /api/v1/purchaseOrders (stable). V3 alternative GET /api/v3/purchaseOrders.",
    "/api/v1/purchaseOrders",
  );

  // Delivery notes. Source path GET /api/v1/deliveryNotes. Not /deliveries.
  registerList(
    server,
    cfg,
    "xentral_list_delivery_notes",
    "List delivery notes",
    "Read only. List delivery note documents from GET /api/v1/deliveryNotes. Note the naming trap. /api/v1/deliveries returns shipment level records, not delivery documents. V3 alternative GET /api/v3/deliveryNotes.",
    "/api/v1/deliveryNotes",
  );

  // Suppliers. Source path GET /api/v1/suppliers (V3 list is beta and gated).
  registerList(
    server,
    cfg,
    "xentral_list_suppliers",
    "List suppliers",
    "Read only. List suppliers from GET /api/v1/suppliers. The V3 suppliers list is beta and permission gated, so this uses the stable V1 read.",
    "/api/v1/suppliers",
  );

  // Supplier detail. Source path GET /api/v1/suppliers/{id} (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_supplier",
    "Get supplier",
    "Read only. Get one supplier from GET /api/v1/suppliers/{id}.",
    "/api/v1/suppliers/{id}",
  );

  // Purchase order detail. Source path GET /api/v1/purchaseOrders/{id} (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_purchase_order",
    "Get purchase order",
    "Read only. Get one purchase order from GET /api/v1/purchaseOrders/{id}.",
    "/api/v1/purchaseOrders/{id}",
  );

  // Delivery note detail. Source path GET /api/v1/deliveryNotes/{id} (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_delivery_note",
    "Get delivery note",
    "Read only. Get one delivery note document from GET /api/v1/deliveryNotes/{id}.",
    "/api/v1/deliveryNotes/{id}",
  );

  // Delivery note shipments. Source path GET /api/v1/deliveryNotes/{id}/shipments (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_delivery_note_shipments",
    "Get delivery note shipments",
    "Read only. Get the shipment records for one delivery note from GET /api/v1/deliveryNotes/{id}/shipments. The id is the delivery note id.",
    "/api/v1/deliveryNotes/{id}/shipments",
  );

  // Invoice balance. Source path GET /api/v1/invoices/{id}/balance (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_invoice_balance",
    "Get invoice balance",
    "Read only. Get the open amount and balance for one invoice from GET /api/v1/invoices/{id}/balance. The id is the invoice id.",
    "/api/v1/invoices/{id}/balance",
  );

  // Product sales prices. Source path GET /api/v1/products/{id}/salesPrices (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_product_sales_prices",
    "Get product sales prices",
    "Read only. Get the sales prices for one product from GET /api/v1/products/{id}/salesPrices. The id is the product id. For purchase prices, use xentral_request against /api/v1/products/{id}/purchasePrices.",
    "/api/v1/products/{id}/salesPrices",
  );

  // Webhooks list. Source path GET /api/v1/webhooks (stable). The endpoint
  // accepts the V1 page[number] and page[size] pagination (verified live), so
  // it is registered as a normal list tool.
  registerList(
    server,
    cfg,
    "xentral_list_webhooks",
    "List webhooks",
    "Read only. List configured webhooks from GET /api/v1/webhooks. Paginated with page[number] and page[size].",
    "/api/v1/webhooks",
  );

  // Webhook detail. Source path GET /api/v1/webhooks/{id} (stable).
  registerDetail(
    server,
    cfg,
    "xentral_get_webhook",
    "Get webhook",
    "Read only. Get one webhook configuration from GET /api/v1/webhooks/{id}.",
    "/api/v1/webhooks/{id}",
  );

  // Webhook event types. Source path GET /api/v1/webhookEventTypes (stable).
  // The endpoint accepts the V1 page[] pagination (verified live), so it is a
  // normal list tool. It returns the catalog of event ids a webhook can bind to.
  registerList(
    server,
    cfg,
    "xentral_list_webhook_event_types",
    "List webhook event types",
    "Read only. List the catalog of event types a webhook can bind to, from GET /api/v1/webhookEventTypes. Paginated with page[number] and page[size].",
    "/api/v1/webhookEventTypes",
  );
}
