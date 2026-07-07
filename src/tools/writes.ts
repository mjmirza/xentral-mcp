/**
 * Named write tools for the actions integration users reach for most, grounded
 * in real connector demand (the create sales order, set stock, record shipment,
 * create invoice, create product, create customer flow that every Xentral shop
 * and marketplace integration needs) and cross checked against the bundled
 * spec inventory so every path here is a real operation.
 *
 * Every tool is OFF by default. Each runs its method through the one shared
 * write gate (security.checkWritePolicy), so a write returns a clear error and
 * never touches the network unless the server is started with
 * XENTRAL_MCP_READONLY=false. None of these use DELETE, so none need the extra
 * allow-delete opt-in.
 *
 * The body stays a flexible data object rather than a fabricated per field
 * schema. The description of each tool names the endpoint and the real traps
 * (the absolute stock set, the shipment records tracking not a label, the
 * customer is an address). For the exact body of any endpoint, use
 * xentral_find_endpoint and the Xentral reference.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { requestWithRateLimitRetry } from "../http.js";
import { formatResponse } from "../format.js";
import { checkWritePolicy } from "../security.js";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: `Error. ${message}` }], isError: true };
}

/** A named write tool. method is POST or PATCH, never DELETE. */
interface WriteSpec {
  name: string;
  title: string;
  description: string;
  method: "POST" | "PATCH";
  /** Fixed spec path. Contains {id} when needsId is true. */
  pathTemplate: string;
  needsId: boolean;
}

/** Body plus optional id and verbose flag for a write tool. */
const bodyField = z
  .record(z.string(), z.unknown())
  .optional()
  .describe("The request body as a JSON object. Sent as application/json. For the exact fields, see the Xentral reference for this endpoint.");

const verboseField = z
  .boolean()
  .optional()
  .describe("When true, return the full response. When false or absent, strip empty fields to save tokens.");

const idField = z.string().min(1).describe("The resource id used in the path.");

type CreateArgs = { data?: Record<string, unknown>; verbose?: boolean };
type ActionArgs = { id: string; data?: Record<string, unknown>; verbose?: boolean };

function registerWrite(server: McpServer, cfg: Config, spec: WriteSpec): void {
  const inputSchema: z.ZodRawShape = spec.needsId
    ? { id: idField, data: bodyField, verbose: verboseField }
    : { data: bodyField, verbose: verboseField };

  server.registerTool(
    spec.name,
    { title: spec.title, description: spec.description, inputSchema },
    async (args: CreateArgs | ActionArgs) => {
      // The one gate. A write returns a clear error and never calls the network
      // unless the server was started write enabled.
      const policy = checkWritePolicy(spec.method, cfg);
      if (!policy.ok) return errorResult(policy.reason ?? "Method not permitted.");

      try {
        let path = spec.pathTemplate;
        if (spec.needsId) {
          const id = (args as ActionArgs).id;
          path = path.replace("{id}", encodeURIComponent(id));
        }
        const res = await requestWithRateLimitRetry(cfg, {
          method: spec.method,
          path,
          body: args.data,
        });
        const verbose = args.verbose ?? false;
        return textResult(formatResponse(res.data, { verbose, maxChars: cfg.maxResponseChars }));
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  );
}

/** The write tool catalog. Every path is verified present in the spec inventory. */
const WRITE_SPECS: WriteSpec[] = [
  {
    name: "xentral_create_sales_order",
    title: "Create sales order",
    description:
      "Write. Create a sales order by importing it via POST /api/v1/salesOrders/actions/import. Send the order under a data object with its line items. This is the action every shop and marketplace integration uses to push an order into Xentral. Needs write mode. Start the server with XENTRAL_MCP_READONLY=false.",
    method: "POST",
    pathTemplate: "/api/v1/salesOrders/actions/import",
    needsId: false,
  },
  {
    name: "xentral_cancel_sales_order",
    title: "Cancel sales order",
    description:
      "Write. Cancel a sales order via POST /api/v1/salesOrders/{id}/actions/cancel. The id is the sales order id. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v1/salesOrders/{id}/actions/cancel",
    needsId: true,
  },
  {
    name: "xentral_release_sales_order",
    title: "Release sales order",
    description:
      "Write. Release a sales order for fulfillment via PATCH /api/v3/salesOrders/{id}/actions/release. The id is the sales order id. Needs write mode.",
    method: "PATCH",
    pathTemplate: "/api/v3/salesOrders/{id}/actions/release",
    needsId: true,
  },
  {
    name: "xentral_send_sales_order",
    title: "Send sales order",
    description:
      "Write. Send a sales order document to the customer via PATCH /api/v3/salesOrders/{id}/actions/send. The id is the sales order id. Needs write mode.",
    method: "PATCH",
    pathTemplate: "/api/v3/salesOrders/{id}/actions/send",
    needsId: true,
  },
  {
    name: "xentral_set_product_stock",
    title: "Set product stock",
    description:
      "Write. Set the total stock for a storage location via PATCH /api/v1/storageLocations/setTotalStock. This sets an absolute quantity. It is not a delta and it is not a movement booking. The API has no separate stock movement transaction endpoint, so a correction is a fresh absolute set. Needs write mode.",
    method: "PATCH",
    pathTemplate: "/api/v1/storageLocations/setTotalStock",
    needsId: false,
  },
  {
    name: "xentral_create_shipment",
    title: "Record shipment",
    description:
      "Write. Record a shipment with its tracking against a delivery via POST /api/v1/shipments. This records tracking. It does not generate a carrier label, since the API has no public label generation call. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v1/shipments",
    needsId: false,
  },
  {
    name: "xentral_create_invoice",
    title: "Create invoice",
    description:
      "Write. Create an invoice via POST /api/v1/invoices. To bill an existing order, pass the order reference in the body per the spec. To read the resulting document, use xentral_get_invoice_documents. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v1/invoices",
    needsId: false,
  },
  {
    name: "xentral_create_credit_note",
    title: "Create credit note",
    description:
      "Write. Create a credit note via POST /api/v1/creditNotes, for a refund or a correction. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v1/creditNotes",
    needsId: false,
  },
  {
    name: "xentral_create_product",
    title: "Create product",
    description:
      "Write. Create a product via POST /api/v2/products. Send the product fields under a data object. For a bulk load, call this once per product. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v2/products",
    needsId: false,
  },
  {
    name: "xentral_create_customer",
    title: "Create customer",
    description:
      "Write. Create a customer via POST /api/v2/customers. In Xentral a customer is an address that carries the customer role, so the body is the address shape. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v2/customers",
    needsId: false,
  },
  {
    name: "xentral_create_purchase_order",
    title: "Create purchase order",
    description:
      "Write. Create a purchase order to a supplier via POST /api/v1/purchaseOrders. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v1/purchaseOrders",
    needsId: false,
  },
  {
    name: "xentral_receive_goods",
    title: "Receive goods on purchase order",
    description:
      "Write. Record a goods receipt against a purchase order via POST /api/v1/purchaseOrders/{id}/goodsReceipts, which receives the ordered stock. The id is the purchase order id. This closes the procure to pay loop with xentral_create_purchase_order. Needs write mode.",
    method: "POST",
    pathTemplate: "/api/v1/purchaseOrders/{id}/goodsReceipts",
    needsId: true,
  },
];

/** Register every named write tool. All are gated by checkWritePolicy. */
export function registerWriteTools(server: McpServer, cfg: Config): void {
  for (const spec of WRITE_SPECS) {
    registerWrite(server, cfg, spec);
  }
}
