# Xentral API. Flows and Gaps

This analysis precedes any tool build. Every path here was read from the two raw specs in `references/`. Prefer the highest available version. V1 is maintenance-only.

## 1. Business flows mapped to real endpoints

### Order to cash (offer, order, delivery, invoice, payment)

The V3 Business Documents API models each document with the same lifecycle shape. create, `release`, `send`, `complete`, `cancel`, plus write-protection toggles and file attachments. Line items are child resources under each document.

Offer stage.
- `GET /api/v3/offers`, `POST /api/v3/offers` [beta], `GET /api/v3/offers/{id}`, `PATCH /api/v3/offers/{id}` [beta].
- Actions. `PATCH /api/v3/offers/{id}/actions/release`, `.../actions/send`, `.../actions/cancel`.

Sales order stage.
- List and view. `GET /api/v3/salesOrders`, `GET /api/v3/salesOrders/{id}` (V1 `GET /api/v1/salesOrders` still stable).
- Create and change. `POST /api/v3/salesOrders` [beta], `PATCH /api/v3/salesOrders/{id}` [beta], line items under `/api/v3/salesOrders/{id}/lineItems`.
- Actions. `.../actions/release`, `.../actions/send`, `.../actions/complete`, `.../actions/cancel`.
- V1 fulfillment trigger. `POST /api/v1/salesOrders/{id}/actions/dispatch` moves an order into fulfillment.

Delivery stage.
- View. `GET /api/v3/deliveryNotes`, `GET /api/v3/deliveryNotes/{id}` (V1 `GET /api/v1/deliveryNotes`).
- Create and change. `POST /api/v3/deliveryNotes` [beta], `PATCH /api/v3/deliveryNotes/{id}` [beta].
- Actions. `.../actions/complete`, `.../actions/send`, `.../actions/cancel`.
- Shipment reads. `GET /api/v1/deliveryNotes/{id}/shipments`, `GET /api/v1/shipments/{id}`.

Invoice stage.
- View. `GET /api/v3/invoices`, `GET /api/v3/invoices/{id}` (V1 `GET /api/v1/invoices`, plus `GET /api/v1/invoices/{id}/balance` for open amount).
- Create from upstream document. `POST /api/v3/invoices/actions/createFromSalesOrder` [beta] and `POST /api/v3/invoices/actions/createFromDeliveryNote` [beta]. Direct create is `POST /api/v3/invoices` [beta] or `POST /api/v1/invoices`.
- Send. `PATCH /api/v3/invoices/{id}/actions/send` (V2 `PATCH /api/v2/invoices/{id}/actions/send`, V1 `PATCH /api/v1/invoices/{id}/send` is deprecated).

Payment stage.
- There is no create-payment endpoint in the public spec. Payment is read and reconciled, not posted, through the API.
- `GET /api/v1/paymentTransactions/{id}`, `PATCH /api/v1/paymentTransactions/{id}/status`, `GET /api/v1/invoices/{id}/balance`, `GET /api/v1/paymentMethods`.

### Procure to pay (purchase order, goods receipt, supplier invoice)

- Purchase order. `GET /api/v3/purchaseOrders`, `GET /api/v3/purchaseOrders/{id}` (V1 `GET /api/v1/purchaseOrders`). Create `POST /api/v3/purchaseOrders` [beta] or `POST /api/v1/purchaseOrders`. Actions `release`, `send`, `complete`, `cancel`.
- Goods receipt against a PO. `POST /api/v1/purchaseOrders/{id}/goodsReceipts`.
- Supplier invoice. present in V3 (tag `SupplierInvoice`) as reads and file attachment. Confirm the create path against the raw spec before building, since the public write side is thin.
- Purchase prices per product. `GET /api/v1/products/{id}/purchasePrices`.

### Inventory and stock

- Per-product stock. `GET /api/v1/products/{id}/stocks` (no global all-stock list exists, stock is read per product).
- Storage locations and items. `GET /api/v1/warehouses` [beta], `GET /api/v1/warehouses/{warehouseId}/storageLocations` [beta], `GET /api/v2/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items`.
- Stock movement. items are added and retrieved at a storage location via `POST` and `PATCH` on `/api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items`, and movement types come from `POST /api/v1/stockMovementTypes`. This is the write path behind the "update stock" guide, there is no single set-quantity call.
- Product reservations. `GET /api/v1/products/{id}/reservations`.

### Fulfillment, shipping, returns

- Fulfillment starts at `POST /api/v1/salesOrders/{id}/actions/dispatch`, then delivery note, pick list (tag `Pick List`), shipment.
- Returns. `POST /api/v3/returnOrders` [beta] or `POST /api/v1/returns`, plus `POST /api/v3/returnOrders/actions/createFromDeliveryNote` [beta]. Goods receipt on a return via `POST /api/v1/returns/{id}/goodsReceipts`.
- Credit note. `POST /api/v3/creditNotes` [beta] or `POST /api/v1/creditNotes`, send via `.../actions/send`.

### Master data (customers, suppliers, products)

- Customers. `GET /api/v2/customers`, `GET /api/v2/customers/{id}`, `POST /api/v2/customers`, `PATCH /api/v2/customers/{id}`. A V3 form exists but is beta and permission-gated.
- Suppliers. `GET /api/v1/suppliers`, `GET /api/v1/suppliers/{id}`. A V3 form exists but is beta and permission-gated.
- Products. `GET /api/v2/products`, `GET /api/v2/products/{id}`, plus many child reads (prices, stock, parts, media, properties, storage locations).

### Accounting and analytics

- Accounting export. `Accounting Export` tag, download at `GET /reference` equivalent `accountingdatevdownload`. Tax rates at `GET` under tag `Tax Rate`.
- Analytics. execute a query synchronously (result capped at a reasonable count, reports capped at 5000 records), use the export endpoints for full pulls. General ledger, account mapping, and tax mapping have their own tags.

### Event-driven integration

- Webhooks. `GET /api/v1/webhookEventTypes`, `GET /api/v1/webhooks`, `POST /api/v1/webhooks`, `GET/PATCH/DELETE /api/v1/webhooks/{id}`. A well-built MCP can register and read webhooks so a client reacts to document events instead of polling.

## 2. Corrected mapping for the planned read tools

The planned set is products, product, stock, storage, customers, customer, sales orders, sales order, invoices, invoice, purchase orders, deliveries, suppliers. Verified paths and required params below.

| Tool | Correct method and path | Required params | Notes |
|------|-------------------------|-----------------|-------|
| products | `GET /api/v2/products` | none | V1 `GET /api/v1/products` is deprecated. use V2. |
| product | `GET /api/v2/products/{id}` | `id` | V1 detail is deprecated. |
| stock | `GET /api/v1/products/{id}/stocks` | `id` | Per-product only. no global stock list exists. a plain `stock` tool must take a product id. |
| storage | `GET /api/v1/warehouses` then `GET /api/v1/warehouses/{warehouseId}/storageLocations` then `GET /api/v2/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items` | `warehouseId`, `storageLocationId` for items | warehouses and storageLocations are beta. items V1 is deprecated, use items V2. this is three levels, not one call. |
| customers | `GET /api/v2/customers` | none | V3 customers list is beta and permission-gated. use V2. |
| customer | `GET /api/v2/customers/{id}` | `id` | V3 detail is beta. |
| sales orders | `GET /api/v3/salesOrders` | none | V1 `GET /api/v1/salesOrders` is stable and not deprecated, so either works. V3 is newer and uses the V3 pagination family. |
| sales order | `GET /api/v3/salesOrders/{id}` | `id` | V1 `GET /api/v1/salesOrders/{id}` also valid. sub-document reads differ by version. |
| invoices | `GET /api/v3/invoices` | none | V1 `GET /api/v1/invoices` also stable. |
| invoice | `GET /api/v3/invoices/{id}` | `id` | For open amount use `GET /api/v1/invoices/{id}/balance`. |
| purchase orders | `GET /api/v3/purchaseOrders` | none | V1 `GET /api/v1/purchaseOrders` also stable. |
| deliveries | `GET /api/v1/deliveryNotes` | none | Naming trap. `GET /api/v1/deliveries` returns shipment-level records and its detail `GET /api/v1/deliveries/{id}` is deprecated. the delivery document list is `deliveryNotes`. V3 `GET /api/v3/deliveryNotes` is the modern form. |
| suppliers | `GET /api/v1/suppliers` | none | V3 suppliers list is beta and permission-gated. use V1 for stable reads, `GET /api/v1/suppliers/{id}` for detail. |

Flags to carry into the build.
- `stock` and `storage` cannot be flat list tools. both need parent ids. plan a two-step call or accept the id as input.
- `deliveries` must point at `deliveryNotes`, not `deliveries`.
- `suppliers` and `customers` V3 reads are beta and gated. the stable reads are V1 suppliers and V2 customers.

## 3. Gaps and cautions

Deprecated reads a naive build would grab.
- `GET /api/v1/products`, `GET /api/v1/products/{id}`, `GET /api/v1/products/{id}/media` (use V2).
- `GET /api/v1/deliveries/{id}` (deprecated) and the `deliveries` vs `deliveryNotes` confusion.
- `GET /api/v1/warehouses/.../items` V1 (use V2).
- `PATCH /api/v1/invoices/{id}/send` (use V2 or V3 send action).

Beta and early-access endpoints (109 flagged). warehouses, storage locations, all V3 document create and update operations (offers, sales orders, delivery notes, invoices, purchase orders, credit notes, return orders), V3 customers, V3 suppliers, payment terms groups. Every one warns it will change without notice or versioning. Gate them behind a flag and pin to the spec version noted in the file.

Permission-gated V3 reads. the V3 customer and supplier reads show a lock marker in their summary and are beta, so a token without the right permission gets a 403 even though the path is correct.

Heavy required params. storage items need both `warehouseId` and `storageLocationId`. product sub-resources need the product `id`. document line-item reads need both the document `id` and the `lineItemId`.

Pagination pitfalls.
- V1 and V2 use bracket syntax, `page[number]` and `page[size]` (max 50), with `filter[n][key|op|value]` and `order[n][field|dir]`. Allowed filter keys are enumerated per resource, so a generic filter string will 400.
- V3 uses `X-Pagination` (simple, table, cursor) with `perPage` (default 15) and either `page` or `cursor`. In the default `simple` mode there is no total, so a client that reads `total` from a V3 list gets nothing unless it sets `X-Pagination: table`.
- Total and cursor come from the `extra` envelope, not from `data`.

Write-endpoint risks (record now for the write phase).
- Update sales order replaces the full positions list. any line item left out of the payload is deleted. always send existing line-item ids to keep them.
- Cancel is status-gated. only sales orders in `created` or `completed` can be canceled. drafts use delete.
- Several writes accept non-json media types (`vnd.xentral.upsert+json`, `vnd.xentral.minimal+json`, `vnd.xentral.fromreturn+json`, `x-www-form-urlencoded`, `vnd.xentral.force`). the hosted doc viewer hides some. read `requestBody.content` in the raw spec.
- Rate limit is 100 requests per minute, 429 on breach, and the limit is stated as provisional.

Two-spec, three-version reality. the same resource can appear in `/api/v1`, `/api/v2`, and `/api/v3` with different params, different pagination, and different envelopes. a tool must pin one version and not mix.

## 4. Coverage recommendation for a top-tier MCP

Read coverage. wire full read coverage across the 194 GET operations, since reads are low risk. Prioritize the stable versions for the common resources (products V2, customers V2, suppliers V1, sales orders and invoices and delivery notes and purchase orders in V3 or V1). Add the child reads that carry real value (invoice balance, product stock, product prices, delivery note shipments, sales order line items). Expose beta reads (warehouses, storage, V3 customers, V3 suppliers) behind an explicit beta flag so a caller opts in.

Selected writes with guardrails. do not expose all 354 writes. Start with the document lifecycle that matters and put guardrails on each.
- Create sales order, then its `release` and `send` and `cancel` actions.
- Create invoice from a sales order or delivery note, then `send`.
- Create delivery note and `complete`.
- Create purchase order and goods receipt.
- Create return order and credit note.
Guardrails for every write. confirm the required media type from the spec, block the destructive sales-order-update foot-gun by always echoing existing line-item ids, respect the status gate on cancel, and honor the rate limit with backoff on 429.

Generic passthrough for the long tail. add one guarded generic-request tool that takes method, path, query, and body, validates the path against the endpoint inventory, forces the Bearer header, and refuses any path not present in the spec. This covers the accounting, analytics, tax, POS, and platform endpoints that do not each earn a named tool, without hardcoding all 548.

Webhook support. register and read webhooks so an integration reacts to document events rather than polling, which also keeps a client under the 100 req/min limit.

Version and beta discipline. pin each tool to a specific `/api/vN` path from the inventory, tag beta tools as beta, and re-check the two specs on any Xentral release, since a released version never breaks but a newer version deprecates the old one.
