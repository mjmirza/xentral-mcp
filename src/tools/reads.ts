/**
 * Curated read tools, version aware. Every resource that exists in more than one
 * API version exposes a `version` parameter so a caller can reach v1, v2, or v3
 * of that resource by name, defaulting to the current stable version. Every path
 * is verified present in the bundled spec inventory. All tools are read only.
 *
 * CODE_DELETE_OK: the single-version registerList, registerDetail, and
 * buildListQuery are replaced by version-aware helpers. Every existing tool is
 * preserved, the default version matches the previous fixed path, and only the
 * exported registerReadTools is public, so no caller or test depends on the
 * removed internals.
 *
 * Pagination differs by version and is handled per version. v1 and v2 use the
 * bracket family (page[number], page[size]). v3 uses the flat family (page,
 * perPage) plus the X-Pagination header. The caller passes page and pageSize and
 * the right shape is built for the chosen version.
 *
 * The full 548 operation surface across every version stays reachable through
 * xentral_request and discoverable through xentral_find_endpoint. These named
 * tools are the curated, version-aware conveniences on top of that.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { requestWithRateLimitRetry, type QueryValue } from "../http.js";
import { formatResponse } from "../format.js";

const PAGE_SIZE_MAX = 50;
const PAGE_SIZE_MIN = 10;
const PAGE_SIZE_DEFAULT = 10;
const PAGE_NUMBER_DEFAULT = 1;
const V3_PER_PAGE_MAX = 100;

type Version = "v1" | "v2" | "v3";

/** One version of a resource. path is the exact spec path. accept overrides the
 * Accept header for an endpoint that does not serve plain application/json. */
interface VersionSpec {
  path: string;
  deprecated?: boolean;
  beta?: boolean;
  accept?: string;
}
type Versions = Partial<Record<Version, VersionSpec>>;

/** Order versions v1, v2, v3 for stable listing in descriptions and enums. */
function versionKeys(versions: Versions): Version[] {
  return (["v1", "v2", "v3"] as Version[]).filter((v) => versions[v] !== undefined);
}

/** A short human note of which versions exist and their status. */
function versionsNote(versions: Versions, def: Version): string {
  const parts = versionKeys(versions).map((v) => {
    const s = versions[v]!;
    const flags = [s.deprecated ? "deprecated" : "", s.beta ? "beta" : "", v === def ? "default" : ""].filter(Boolean);
    return flags.length ? `${v} (${flags.join(", ")})` : v;
  });
  return parts.join(", ");
}

/** Shared list input, minus the version param which is added per tool. */
const baseListInput = {
  page: z.number().int().min(1).optional().describe("Page number, starting at 1. Default 1."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(V3_PER_PAGE_MAX)
    .optional()
    .describe(
      `Rows per page. For v1 and v2 the API accepts ${PAGE_SIZE_MIN} to ${PAGE_SIZE_MAX} and a value below ${PAGE_SIZE_MIN} is raised to ${PAGE_SIZE_MIN}. For v3 up to ${V3_PER_PAGE_MAX}. Default ${PAGE_SIZE_DEFAULT}.`,
    ),
  query: z.string().optional().describe("Optional free text passed as the search parameter. Best effort, some endpoints ignore it."),
  paginationMode: z
    .enum(["simple", "table", "cursor"])
    .optional()
    .describe("v3 only. simple (default) is lightest. table also returns the total row count for total-based paging. cursor for keyset paging. Ignored for v1 and v2."),
  verbose: z.boolean().optional().describe("When true, return the full payload. When false or absent, strip empty fields to save tokens."),
};

const baseDetailInput = {
  id: z.string().min(1).describe("The resource id."),
  verbose: z.boolean().optional().describe("When true, return the full payload. When false or absent, strip empty fields to save tokens."),
};

interface ListArgs {
  page?: number;
  pageSize?: number;
  query?: string;
  paginationMode?: "simple" | "table" | "cursor";
  verbose?: boolean;
  version?: Version;
}
interface DetailArgs {
  id: string;
  verbose?: boolean;
  version?: Version;
}

/** v1 and v2 bracket pagination. Both keys are always sent together (the API
 * rejects one without the other) and the size is clamped into 10 to 50. */
function buildQueryV1V2(args: ListArgs): Record<string, QueryValue> {
  const q: Record<string, QueryValue> = {};
  const number = args.page !== undefined && args.page > 0 ? args.page : PAGE_NUMBER_DEFAULT;
  const requested = args.pageSize !== undefined ? args.pageSize : PAGE_SIZE_DEFAULT;
  q["page[number]"] = number;
  q["page[size]"] = Math.min(PAGE_SIZE_MAX, Math.max(PAGE_SIZE_MIN, requested));
  if (args.query !== undefined && args.query !== "") q["search"] = args.query;
  return q;
}

/** v3 flat pagination. page and perPage as plain keys. A total count comes from
 * the X-Pagination header, set by the caller of this builder. */
function buildQueryV3(args: ListArgs): Record<string, QueryValue> {
  const q: Record<string, QueryValue> = {};
  q["page"] = args.page !== undefined && args.page > 0 ? args.page : PAGE_NUMBER_DEFAULT;
  q["perPage"] = Math.min(V3_PER_PAGE_MAX, Math.max(1, args.pageSize ?? PAGE_SIZE_DEFAULT));
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

/** Resolve which version to use from the args, defaulting to def, and error if
 * the caller asked for a version this resource does not have. */
function resolveVersion(
  versions: Versions,
  def: Version,
  requested: Version | undefined,
): { ok: true; version: Version; spec: VersionSpec } | { ok: false; reason: string } {
  const v = requested ?? def;
  const spec = versions[v];
  if (spec === undefined) {
    return { ok: false, reason: `Version ${v} is not available for this resource. Available. ${versionKeys(versions).join(", ")}.` };
  }
  return { ok: true, version: v, spec };
}

/** Add a version enum to an input shape only when the resource has 2+ versions. */
function withVersion(base: Record<string, z.ZodTypeAny>, versions: Versions, def: Version): z.ZodRawShape {
  const keys = versionKeys(versions);
  if (keys.length < 2) return base;
  return {
    ...base,
    version: z
      .enum(keys as [Version, ...Version[]])
      .optional()
      .describe(`API version to call. Available. ${versionsNote(versions, def)}. Default ${def}.`),
  };
}

/** Register a version-aware list tool. */
function registerVersionedList(
  server: McpServer,
  cfg: Config,
  name: string,
  title: string,
  description: string,
  versions: Versions,
  def: Version,
): void {
  server.registerTool(
    name,
    { title, description, inputSchema: withVersion(baseListInput, versions, def) },
    async (rawArgs) => {
      const args = rawArgs as unknown as ListArgs;
      const r = resolveVersion(versions, def, args.version);
      if (!r.ok) return errorResult(new Error(r.reason));
      try {
        const isV3 = r.version === "v3";
        const query = isV3 ? buildQueryV3(args) : buildQueryV1V2(args);
        const headers: Record<string, string> = {};
        if (r.spec.accept) headers.Accept = r.spec.accept;
        if (isV3) headers["X-Pagination"] = args.paginationMode ?? "simple";
        const res = await requestWithRateLimitRetry(cfg, {
          method: "GET",
          path: r.spec.path,
          query,
          headers: Object.keys(headers).length ? headers : undefined,
        });
        return textResult(formatResponse(res.data, { verbose: args.verbose ?? false, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** Register a version-aware detail tool. The path must contain {id}. */
function registerVersionedDetail(
  server: McpServer,
  cfg: Config,
  name: string,
  title: string,
  description: string,
  versions: Versions,
  def: Version,
): void {
  server.registerTool(
    name,
    { title, description, inputSchema: withVersion(baseDetailInput, versions, def) },
    async (rawArgs) => {
      const args = rawArgs as unknown as DetailArgs;
      const r = resolveVersion(versions, def, args.version);
      if (!r.ok) return errorResult(new Error(r.reason));
      try {
        const path = r.spec.path.replace("{id}", encodeURIComponent(args.id));
        const headers = r.spec.accept ? { Accept: r.spec.accept } : undefined;
        const res = await requestWithRateLimitRetry(cfg, { method: "GET", path, headers });
        return textResult(formatResponse(res.data, { verbose: args.verbose ?? false, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** A single-version detail sub-resource (stock, prices, balance, documents). */
function registerSubDetail(
  server: McpServer,
  cfg: Config,
  name: string,
  title: string,
  description: string,
  pathTemplate: string,
): void {
  server.registerTool(
    name,
    { title, description, inputSchema: baseDetailInput },
    async (args: DetailArgs) => {
      try {
        const path = pathTemplate.replace("{id}", encodeURIComponent(args.id));
        const res = await requestWithRateLimitRetry(cfg, { method: "GET", path });
        return textResult(formatResponse(res.data, { verbose: args.verbose ?? false, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** A single-version list (webhooks, event types). */
function registerSubList(
  server: McpServer,
  cfg: Config,
  name: string,
  title: string,
  description: string,
  path: string,
): void {
  server.registerTool(
    name,
    { title, description, inputSchema: baseListInput },
    async (args: ListArgs) => {
      try {
        const res = await requestWithRateLimitRetry(cfg, { method: "GET", path, query: buildQueryV1V2(args) });
        return textResult(formatResponse(res.data, { verbose: args.verbose ?? false, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

/** Register every curated read tool, version aware where more than one exists. */
export function registerReadTools(server: McpServer, cfg: Config): void {
  // Products. v2 is the current stable version. v1 is deprecated, so it is not
  // exposed. Single stable version, no version parameter.
  registerVersionedList(
    server, cfg, "xentral_list_products", "List products",
    "Read only. List products from the current stable GET /api/v2/products. The deprecated v1 is not exposed.",
    { v2: { path: "/api/v2/products" } }, "v2",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_product", "Get product",
    "Read only. Get one product from the current stable GET /api/v2/products/{id}. The deprecated v1 is not exposed.",
    { v2: { path: "/api/v2/products/{id}" } }, "v2",
  );

  // Customers. v2 is the current stable version. v3 is beta and permission
  // gated, so only the stable v2 is exposed.
  registerVersionedList(
    server, cfg, "xentral_list_customers", "List customers",
    "Read only. List customers from the current stable GET /api/v2/customers. The beta v3 is not exposed.",
    { v2: { path: "/api/v2/customers" } }, "v2",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_customer", "Get customer",
    "Read only. Get one customer from the current stable GET /api/v2/customers/{id}. The beta v3 is not exposed.",
    { v2: { path: "/api/v2/customers/{id}" } }, "v2",
  );

  // Sales orders. v1 and v3 both stable. Default v1 for the widest field set.
  registerVersionedList(
    server, cfg, "xentral_list_sales_orders", "List sales orders",
    "Read only. List sales orders. Version aware, v1 and v3 are both stable. v3 uses the flat pagination family. Default v1.",
    { v1: { path: "/api/v1/salesOrders" }, v3: { path: "/api/v3/salesOrders" } }, "v1",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_sales_order", "Get sales order",
    "Read only. Get one sales order. Version aware, v1 and v3 both stable. Default v1.",
    { v1: { path: "/api/v1/salesOrders/{id}" }, v3: { path: "/api/v3/salesOrders/{id}" } }, "v1",
  );

  // Invoices. v1 needs the minimal+json Accept header, v3 is plain json.
  registerVersionedList(
    server, cfg, "xentral_list_invoices", "List invoices",
    "Read only. List invoices. Version aware. v1 serves application/vnd.xentral.minimal+json (the tool sets that header on v1). v3 is plain json with flat pagination. Default v1.",
    { v1: { path: "/api/v1/invoices", accept: "application/vnd.xentral.minimal+json" }, v3: { path: "/api/v3/invoices" } }, "v1",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_invoice", "Get invoice",
    "Read only. Get one invoice. Version aware, v1 and v3 both stable. Default v1.",
    { v1: { path: "/api/v1/invoices/{id}" }, v3: { path: "/api/v3/invoices/{id}" } }, "v1",
  );

  // Purchase orders. v1 and v3 both stable.
  registerVersionedList(
    server, cfg, "xentral_list_purchase_orders", "List purchase orders",
    "Read only. List purchase orders. Version aware, v1 and v3 both stable. Default v1.",
    { v1: { path: "/api/v1/purchaseOrders" }, v3: { path: "/api/v3/purchaseOrders" } }, "v1",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_purchase_order", "Get purchase order",
    "Read only. Get one purchase order. Version aware, v1 and v3 both stable. Default v1.",
    { v1: { path: "/api/v1/purchaseOrders/{id}" }, v3: { path: "/api/v3/purchaseOrders/{id}" } }, "v1",
  );

  // Delivery notes. v1 and v3 both stable. Note. /api/v1/deliveries is shipment level, not this.
  registerVersionedList(
    server, cfg, "xentral_list_delivery_notes", "List delivery notes",
    "Read only. List delivery note documents. Version aware, v1 and v3 both stable. Note the naming trap, /api/v1/deliveries is shipment level, not delivery documents. Default v1.",
    { v1: { path: "/api/v1/deliveryNotes" }, v3: { path: "/api/v3/deliveryNotes" } }, "v1",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_delivery_note", "Get delivery note",
    "Read only. Get one delivery note document. Version aware, v1 and v3 both stable. Default v1.",
    { v1: { path: "/api/v1/deliveryNotes/{id}" }, v3: { path: "/api/v3/deliveryNotes/{id}" } }, "v1",
  );

  // Suppliers. v1 is the stable version. v3 is beta and permission gated, so
  // only the stable v1 is exposed.
  registerVersionedList(
    server, cfg, "xentral_list_suppliers", "List suppliers",
    "Read only. List suppliers from the stable GET /api/v1/suppliers. The beta v3 is not exposed.",
    { v1: { path: "/api/v1/suppliers" } }, "v1",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_supplier", "Get supplier",
    "Read only. Get one supplier from the stable GET /api/v1/suppliers/{id}. The beta v3 is not exposed.",
    { v1: { path: "/api/v1/suppliers/{id}" } }, "v1",
  );

  // Offers (Angebote). v3 only. The quote-to-order entry point.
  registerVersionedList(
    server, cfg, "xentral_list_offers", "List offers",
    "Read only. List offers (Angebote) from GET /api/v3/offers. The quote-to-order flow. v3 flat pagination.",
    { v3: { path: "/api/v3/offers" } }, "v3",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_offer", "Get offer",
    "Read only. Get one offer (Angebot) from GET /api/v3/offers/{id}.",
    { v3: { path: "/api/v3/offers/{id}" } }, "v3",
  );

  // Credit notes. v1 and v3 both stable.
  registerVersionedList(
    server, cfg, "xentral_list_credit_notes", "List credit notes",
    "Read only. List credit notes. Version aware. Like v1 invoices, v1 credit notes serve application/vnd.xentral.minimal+json (the tool sets that header on v1), plain json returns a 406. v3 is plain json. Default v1.",
    { v1: { path: "/api/v1/creditNotes", accept: "application/vnd.xentral.minimal+json" }, v3: { path: "/api/v3/creditNotes" } }, "v1",
  );
  registerVersionedDetail(
    server, cfg, "xentral_get_credit_note", "Get credit note",
    "Read only. Get one credit note. Version aware, v1 and v3 both stable. Default v1.",
    { v1: { path: "/api/v1/creditNotes/{id}" }, v3: { path: "/api/v3/creditNotes/{id}" } }, "v1",
  );

  // Single-version sub-resources. These exist at one version only.
  registerSubDetail(server, cfg, "xentral_get_product_stock", "Get product stock",
    "Read only. Stock levels for one product from GET /api/v1/products/{id}/stocks. Per product only, no global list.",
    "/api/v1/products/{id}/stocks");
  registerSubDetail(server, cfg, "xentral_get_product_sales_prices", "Get product sales prices",
    "Read only. Sales prices for one product from GET /api/v1/products/{id}/salesPrices. For purchase prices use xentral_request against /api/v1/products/{id}/purchasePrices.",
    "/api/v1/products/{id}/salesPrices");
  registerSubDetail(server, cfg, "xentral_get_invoice_balance", "Get invoice balance",
    "Read only. Open amount and balance for one invoice from GET /api/v1/invoices/{id}/balance.",
    "/api/v1/invoices/{id}/balance");
  registerSubDetail(server, cfg, "xentral_get_invoice_documents", "Get invoice documents",
    "Read only. Document and PDF references for one invoice from GET /api/v1/invoices/{id}/documents. For uploaded file attachments, use xentral_request against /api/v2/invoice/{id}/files.",
    "/api/v1/invoices/{id}/documents");
  registerSubDetail(server, cfg, "xentral_get_delivery_note_shipments", "Get delivery note shipments",
    "Read only. Shipment records for one delivery note from GET /api/v1/deliveryNotes/{id}/shipments.",
    "/api/v1/deliveryNotes/{id}/shipments");

  // Webhooks. Single version v1.
  registerSubList(server, cfg, "xentral_list_webhooks", "List webhooks",
    "Read only. List configured webhooks from GET /api/v1/webhooks.", "/api/v1/webhooks");
  registerSubDetail(server, cfg, "xentral_get_webhook", "Get webhook",
    "Read only. Get one webhook configuration from GET /api/v1/webhooks/{id}.", "/api/v1/webhooks/{id}");
  registerSubList(server, cfg, "xentral_list_webhook_event_types", "List webhook event types",
    "Read only. The catalog of event types a webhook can bind to, from GET /api/v1/webhookEventTypes.", "/api/v1/webhookEventTypes");
}
