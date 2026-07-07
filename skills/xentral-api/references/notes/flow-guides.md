# Xentral Flow Guides. Grounded Multi-Step Processes

Distilled from the official developer guides linked in `llms.txt` (developer.xentral.com/docs). Every path below was cross-checked against `src/data/endpoint-inventory.json`. These flows add process knowledge the raw OpenAPI spec does not spell out. Where a guide contradicts the spec, the spec wins and the conflict is flagged here.

## Guide error to know about

The returns guide cites `GET /api/v4/warehouses`. There is no v4 in either public spec (0 v4 operations). The real path is `GET /api/v1/warehouses`. Treat any v4 reference in the guides as a typo for v1.

## 1. Create a sales order

The stable create path is `POST /api/v1/salesOrders/actions/import`, content type `application/json`. The V3 form `POST /api/v3/salesOrders` exists but is beta and permission gated.

Prerequisite lookups (each returns an id the create call needs).
- `GET /api/v2/customers` to find the customer, or `POST /api/v2/customers` to create one. The new id comes back in the `Location` header.
- `GET /api/v1/projects` for the project id. A project cannot be created through the API.
- `GET /api/v1/paymentMethods` for the payment method id.
- `GET /api/v1/shippingMethods` for the shipping method id.
- `GET /api/v2/products` to find each product id.

Required body fields. `date`, `customer.id`, `project.id`, `financials.paymentMethod.id`, `financials.currency`, `delivery.shippingMethod.id`, and `positions[]`. Each position needs `product.id`, `quantity`, `price.amount`, `price.currency`.

Traps.
- The import endpoint creates the order directly in `released` status. It skips the `created` draft phase.
- Only orders in `created` (draft) status can be deleted. A released or completed order returns 409 on delete.
- Without a position price, Xentral falls back to the product master price. If none exists, the import fails.
- Set `externalOrderNumber` so a retried import does not create a duplicate.
- If auto dispatch is on, fulfillment may start at once. Send `autoShipping: false` when more steps are needed first.

## 2. Read stock

Stock is read per product. There is no single global stock list.
- `GET /api/v1/products/{id}/stocks` returns aggregated totals across warehouses. Fields include `totals.sellable`, `totals.physical`, `totals.reserved`, `totals.openSalesOrders`, and a per-warehouse breakdown in `warehouses[]`.
- `GET /api/v1/products/{id}/storageLocations` returns which locations hold the product and the quantity at each. It does not include batch, best-before date, or serial numbers.
- `GET /api/v1/products/{id}/reservations` returns the sales orders claiming stock. Reservations are not warehouse specific, so per-warehouse sellable stock cannot be computed by subtraction.
- `GET /api/v1/warehouses` then `GET /api/v1/warehouses/{warehouseId}/storageLocations` then `GET /api/v2/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items` walks the tree and the V2 items call adds the quality control attributes. This is one call per location, which is heavy for a large warehouse.

## 3. Update stock

Three distinct write paths, each with its own identifier rule. This is the "no single set-quantity call" reality.
- Stock in. `POST /api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items`. Identifies the product by SKU, not id. Returns 201.
- Stock out. `PATCH` on the same path (the method is PATCH, not DELETE). Also by SKU. Returns 204. It cannot remove more than exists (400).
- Set total. `PATCH /api/v1/storageLocations/setTotalStock`. Identifies the product by id. This is destructive. Any product not in the payload is set to zero at that location, including its quality control attributes. Send one request per location, roughly 10 to 15 products each.
- Goods receipt from a purchase order. `POST /api/v1/purchaseOrders/{id}/goodsReceipts`, by product id, references an existing `purchaseOrderPosition` id. Partial quantities are allowed for split deliveries.
- Goods receipt from a return. `POST /api/v1/returns/{id}/goodsReceipts`, references an existing `returnPosition` id.

Prerequisites for any stock write. the warehouse exists, the storage location exists inside it, and the product is flagged `isStockItem: true`.

## 4. Fulfillment

Order to shipment, in order.
1. React to the `salesOrder.dispatched` webhook, which carries `salesOrderId`. The order must be `released` before dispatch.
2. `GET /api/v1/salesOrders/{salesOrderId}` for the order detail and address.
3. `GET /api/v3/deliveryNotes` filtered by `salesOrder.id`, or `GET /api/v3/deliveryNotes/{id}` if the id is known. The list only returns delivery notes in `released` or later. Add `include[]=lineItems` and `include[]=lineItems.product` to pull line detail.
4. Optionally assign quality control attributes while the delivery note stays `released`.
5. `POST /api/v1/shipments` with `type: "deliveryNote"`, `deliveryNote.id`, and `trackingNumber`. `shippingMethod.id` is required when the delivery note has none. Returns 204 with no body.
6. `GET /api/v1/shipments/{id}` for `tracking.number`, `tracking.link`, and `label.fileContent` (base64), which is populated only when Xentral made the label.
7. The delivery note PDF comes from `GET /api/v3/deliveryNotes/{id}` with header `Accept: application/pdf`.

## 5. Returns and credit notes

A return tracks physical goods. A credit note is the financial refund. The link between them is optional. An exchange can be a return with no credit note, and goodwill can be a credit note with no return.

V1 stable path.
1. `GET /api/v1/returnReasons` to map a reason name to its id.
2. `POST /api/v1/returns` from a sales order, with position ids and a return reason id. Starts in `created`.
3. `POST /api/v1/returns/{id}/actions/release`. Requires `created` status.
4. `POST /api/v1/returns/{id}/goodsReceipts` to book the items back into stock. Requires `released` status. Creating a return does not move stock on its own. V1 has no credit note create.

V3 beta path.
1. `POST /api/v3/returnOrders`, or `POST /api/v3/returnOrders/actions/createFromDeliveryNote` which auto resolves the sales order, address, and project so only line items and reasons are given. Starts in `draft`.
2. `PATCH /api/v3/returnOrders/{id}/actions/release`. Requires `draft`.
3. `POST /api/v3/creditNotes`, then `PATCH /api/v3/creditNotes/{id}/actions/release`. Release turns on write protection.
4. `PATCH /api/v3/returnOrders/{id}` to link the credit note id.

Status gates. only a `released` return order can be cancelled. a `draft` one is deleted, not cancelled. return quantity cannot exceed the original ordered quantity.

## How this maps to the MCP

The named read tools cover the common list and detail reads. Everything else in these flows (the lookups, the child reads, the create and action writes) is reachable through the one guarded generic tool `xentral_request`, which validates the path against the inventory and permits a write only when the server runs with `XENTRAL_MCP_READONLY=false`. The destructive cases above (setTotalStock, a sales order line-item PATCH that drops omitted items, a delete that is 409 on a released document) are why writes are off by default.
