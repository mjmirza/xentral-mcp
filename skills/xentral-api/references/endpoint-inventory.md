# Xentral API Endpoint Inventory

Generated from the raw OpenAPI specs in this folder. Two specs combined.

- `xentral-openapi.json` (Xentral API, OpenAPI 3.0.0, tag `core` below). 339 operations.
- `xentral-documents-openapi.json` (Xentral Business Documents API v3, OpenAPI 3.1.0, tag `documents-v3` below). 209 operations.

## Totals

- Total operations. 548
- Read (GET). 194
- Write (POST/PATCH/PUT/DELETE). 354
- Deprecated. 31
- Beta or early-access flagged. 109

Method breakdown. GET 194, POST 121, PATCH 158, PUT 1, DELETE 74.

## Per-domain counts

| Domain | Total | Read | Write |
|--------|-------|------|-------|
| Sales (offers, orders, prices) | 73 | 17 | 56 |
| Invoicing & Payments | 94 | 30 | 64 |
| Fulfillment & Shipping | 38 | 13 | 25 |
| Returns & Goods Receipt | 33 | 9 | 24 |
| Purchasing | 38 | 8 | 30 |
| Inventory & Warehouse | 28 | 8 | 20 |
| Customers | 30 | 12 | 18 |
| Suppliers | 21 | 9 | 12 |
| Products | 80 | 33 | 47 |
| Accounting & Tax | 42 | 21 | 21 |
| Analytics & Reporting | 25 | 12 | 13 |
| Point of Sale | 8 | 3 | 5 |
| Users, Auth & Employees | 11 | 6 | 5 |
| Platform & Meta | 27 | 13 | 14 |

Flag legend. `[B]` beta or early access, `[D]` deprecated. `<core>` = main spec, `<v3>` = documents-v3 spec.

## Sales (offers, orders, prices) (73 ops, 17 read)

- `POST /api/v1/products/{id}/salesChannels` <core> tag=`Sales Channels Product Settings` :: Create product sales channel settings
- `DELETE /api/v1/products/{productId}/salesChannels/{id}` <core> tag=`Sales Channels Product Settings` :: Delete product sales channel settings
- `PATCH /api/v1/products/{productId}/salesChannels/{id}` <core> tag=`Sales Channels Product Settings` :: Update product sales channel settings
- `GET /api/v1/salesOrders` <core> tag=`Sales Order` :: List sales orders
- `POST /api/v1/salesOrders/actions/import` <core> tag=`Sales Order` :: Import sales order
- `DELETE /api/v1/salesOrders/{id}` <core> tag=`Sales Order` :: Delete sales order
- `GET /api/v1/salesOrders/{id}` <core> tag=`Sales Order` :: View sales order
- `PATCH /api/v1/salesOrders/{id}` <core> tag=`Sales Order` :: Update sales order
- `POST /api/v1/salesOrders/{id}/actions/cancel` <core> tag=`Sales Order` :: Cancel sales order
- `PATCH /api/v1/salesOrders/{id}/actions/createPartialSalesOrder` <core> tag=`Sales Order` :: Create partial sales order
- `POST /api/v1/salesOrders/{id}/actions/dispatch` <core> tag=`Sales Order` :: Dispatch sales order
- `DELETE /api/v1/salesOrders/{id}/documents` <core> tag=`Sales Order` :: Delete multiple sales order documents
- `GET /api/v1/salesOrders/{id}/documents` <core> [D] tag=`Sales Order` :: List sales order documents
- `PATCH /api/v1/salesOrders/{id}/documents` <core> tag=`Sales Order` :: Update multiple sales order documents
- `POST /api/v1/salesOrders/{id}/documents` <core> tag=`Sales Order` :: Create sales order document
- `GET /api/v1/salesOrders/{id}/documents/{documentId}` <core> [D] tag=`Sales Order` :: View sales order document
- `GET /api/v1/salesPrices` <core> tag=`Sales Price` :: List sales prices
- `PATCH /api/v1/salesPrices` <core> tag=`Sales Price` :: Update multiple sales prices
- `POST /api/v1/salesPrices` <core> tag=`Sales Price` :: Create sales price
- `DELETE /api/v1/salesPrices/{id}` <core> tag=`Sales Price` :: Delete sales price
- `GET /api/v1/salesPrices/{id}` <core> tag=`Sales Price` :: View sales price
- `PATCH /api/v1/salesPrices/{id}` <core> tag=`Sales Price` :: Update sales price
- `GET /api/v2/salesChannels` <core> tag=`Sales Channel` :: List sales channels V2
- `GET /api/v3/offers` <v3> tag=`Offer` :: List offers V3
- `POST /api/v3/offers` <v3> [B] tag=`Offer` :: 🔒 Create offer V3
- `DELETE /api/v3/offers/{id}` <v3> tag=`Offer` :: Delete offer V3
- `GET /api/v3/offers/{id}` <v3> tag=`Offer` :: View offer V3
- `PATCH /api/v3/offers/{id}` <v3> [B] tag=`Offer` :: 🔒 Update offer V3
- `PATCH /api/v3/offers/{id}/actions/cancel` <v3> tag=`Offer` :: Cancel offer V3
- `PATCH /api/v3/offers/{id}/actions/logActivity` <v3> tag=`Offer` :: Log custom offer activity V3
- `PATCH /api/v3/offers/{id}/actions/release` <v3> tag=`Offer` :: Release offer V3
- `PATCH /api/v3/offers/{id}/actions/removeWriteProtection` <v3> tag=`Offer` :: Remove offer write protection V3
- `PATCH /api/v3/offers/{id}/actions/send` <v3> tag=`Offer` :: Send offer V3
- `PATCH /api/v3/offers/{id}/actions/setWriteProtection` <v3> tag=`Offer` :: Set offer write protection V3
- `POST /api/v3/offers/{id}/files` <v3> tag=`Offer` :: Attach file to offer V3
- `DELETE /api/v3/offers/{id}/files/{fileId}` <v3> tag=`Offer` :: Delete file from offer V3
- `PATCH /api/v3/offers/{id}/files/{fileId}` <v3> tag=`Offer` :: Update file on offer V3
- `POST /api/v3/offers/{id}/lineItems` <v3> [B] tag=`Offer` :: 🔒 Create offer line item V3
- `DELETE /api/v3/offers/{id}/lineItems/{lineItemId}` <v3> tag=`Offer` :: Delete offer line item V3
- `GET /api/v3/offers/{id}/lineItems/{lineItemId}` <v3> tag=`Offer` :: View offer line item V3
- `PATCH /api/v3/offers/{id}/lineItems/{lineItemId}` <v3> [B] tag=`Offer` :: 🔒 Update offer line item V3
- `POST /api/v3/priceInquiries/{id}/files` <v3> tag=`PriceInquiry` :: Attach file to price inquiry V3
- `DELETE /api/v3/priceInquiries/{id}/files/{fileId}` <v3> tag=`PriceInquiry` :: Delete file from price inquiry V3
- `PATCH /api/v3/priceInquiries/{id}/files/{fileId}` <v3> tag=`PriceInquiry` :: Update file on price inquiry V3
- `GET /api/v3/products/{id}/calculationItems` <v3> tag=`ProductCalculation` :: List product calculation line items V3
- `POST /api/v3/products/{id}/calculationItems` <v3> tag=`ProductCalculation` :: Create product calculation line item V3
- `DELETE /api/v3/products/{id}/calculationItems/{itemId}` <v3> tag=`ProductCalculation` :: Delete product calculation line item V3
- `GET /api/v3/products/{id}/calculationItems/{itemId}` <v3> tag=`ProductCalculation` :: View product calculation line item V3
- `PATCH /api/v3/products/{id}/calculationItems/{itemId}` <v3> tag=`ProductCalculation` :: Update product calculation line item V3
- `GET /api/v3/salesOrders` <v3> tag=`SalesOrder` :: List sales orders V3
- `POST /api/v3/salesOrders` <v3> [B] tag=`SalesOrder` :: 🔒 Create sales order V3
- `DELETE /api/v3/salesOrders/{id}` <v3> tag=`SalesOrder` :: Delete sales order V3
- `GET /api/v3/salesOrders/{id}` <v3> tag=`SalesOrder` :: View sales order V3
- `PATCH /api/v3/salesOrders/{id}` <v3> [B] tag=`SalesOrder` :: 🔒 Update sales order V3
- `PATCH /api/v3/salesOrders/{id}/actions/cancel` <v3> tag=`SalesOrder` :: Cancel sales order V3
- `PATCH /api/v3/salesOrders/{id}/actions/complete` <v3> tag=`SalesOrder` :: Complete sales order V3
- `PATCH /api/v3/salesOrders/{id}/actions/logActivity` <v3> tag=`SalesOrder` :: Log custom sales order activity V3
- `PATCH /api/v3/salesOrders/{id}/actions/release` <v3> tag=`SalesOrder` :: Release sales order V3
- `PATCH /api/v3/salesOrders/{id}/actions/removeWriteProtection` <v3> tag=`SalesOrder` :: Remove sales order write protection V3
- `PATCH /api/v3/salesOrders/{id}/actions/send` <v3> tag=`SalesOrder` :: Send sales order V3
- `PATCH /api/v3/salesOrders/{id}/actions/setWriteProtection` <v3> tag=`SalesOrder` :: Set sales order write protection V3
- `POST /api/v3/salesOrders/{id}/files` <v3> tag=`SalesOrder` :: Attach file to sales order V3
- `DELETE /api/v3/salesOrders/{id}/files/{fileId}` <v3> tag=`SalesOrder` :: Delete file from sales order V3
- `PATCH /api/v3/salesOrders/{id}/files/{fileId}` <v3> tag=`SalesOrder` :: Update file on sales order V3
- `POST /api/v3/salesOrders/{id}/lineItems` <v3> [B] tag=`SalesOrder` :: 🔒 Create sales order line item V3
- `DELETE /api/v3/salesOrders/{id}/lineItems/{lineItemId}` <v3> tag=`SalesOrder` :: Delete sales order line item V3
- `GET /api/v3/salesOrders/{id}/lineItems/{lineItemId}` <v3> tag=`SalesOrder` :: View sales order line item V3
- `PATCH /api/v3/salesOrders/{id}/lineItems/{lineItemId}` <v3> [B] tag=`SalesOrder` :: 🔒 Update sales order line item V3
- `GET /api/v3/salesPrices` <v3> [B] tag=`SalesPrice` :: 🔒 List sales prices V3
- `PATCH /api/v3/salesPrices` <v3> [B] tag=`SalesPrice` :: 🔒 Update multiple sales prices V3
- `POST /api/v3/salesPrices` <v3> [B] tag=`SalesPrice` :: 🔒 Create sales price V3
- `DELETE /api/v3/salesPrices/{id}` <v3> tag=`SalesPrice` :: Delete sales price V3
- `GET /api/v3/salesPrices/{id}` <v3> [B] tag=`SalesPrice` :: 🔒 View sales price V3

## Invoicing & Payments (94 ops, 30 read)

- `GET /api/v1/analytics/collection` <core> tag=`Collection` :: List collections
- `POST /api/v1/analytics/collection` <core> tag=`Collection` :: Create collection
- `DELETE /api/v1/analytics/collection/{id}` <core> tag=`Collection` :: Delete collection
- `GET /api/v1/analytics/collection/{id}` <core> tag=`Collection` :: View collection
- `PATCH /api/v1/analytics/collection/{id}` <core> tag=`Collection` :: Update collection
- `GET /api/v1/analytics/credit` <core> tag=`Credit` :: Get credit information
- `POST /api/v1/collectiveBill` <core> tag=`Collective Bill` :: Create collective bill
- `GET /api/v1/creditNotes` <core> tag=`Credit Note` :: List credit notes
- `POST /api/v1/creditNotes` <core> tag=`Credit Note` :: Create credit note
- `GET /api/v1/creditNotes/{id}` <core> tag=`Credit Note` :: View credit note
- `PATCH /api/v1/creditNotes/{id}` <core> tag=`Credit Note` :: Update credit note
- `PATCH /api/v1/creditNotes/{id}/actions/send` <core> tag=`Credit Note` :: Send credit note
- `GET /api/v1/creditNotes/{id}/balance` <core> tag=`Credit Note` :: View Credit Note Balance
- `GET /api/v1/creditNotes/{id}/documents` <core> tag=`Credit Note` :: View related documents for credit note
- `GET /api/v1/creditNotesTags` <core> [D] tag=`Credit Note Tag` :: List Credit Notes tags
- `GET /api/v1/deliveryTerms` <core> tag=`Delivery Terms` :: List delivery terms
- `GET /api/v1/invoices` <core> tag=`Invoice` :: List invoices
- `POST /api/v1/invoices` <core> tag=`Invoice` :: Create invoice
- `GET /api/v1/invoices/{id}` <core> tag=`Invoice` :: View invoice
- `PATCH /api/v1/invoices/{id}` <core> tag=`Invoice` :: Update invoice
- `GET /api/v1/invoices/{id}/balance` <core> tag=`Invoice` :: View invoice balance
- `GET /api/v1/invoices/{id}/documents` <core> tag=`Invoice` :: View related documents for invoice
- `POST /api/v1/invoices/{id}/positions` <core> tag=`Invoice` :: Create positions for invoice
- `PATCH /api/v1/invoices/{id}/send` <core> [D] tag=`Invoice` :: Send invoice
- `PATCH /api/v1/invoices/{id}/status` <core> tag=`Invoice` :: Update status for single invoice
- `GET /api/v1/invoicesTags` <core> [D] tag=`Invoice Tag` :: List Invoice tags
- `GET /api/v1/liabilities` <core> tag=`Liability` :: List liabilities
- `POST /api/v1/liabilities` <core> tag=`Liability` :: Create liability
- `POST /api/v1/liabilities-recurring` <core> tag=`Liability` :: Create recurring liability
- `GET /api/v1/liabilities/{id}` <core> tag=`Liability` :: View liability
- `PATCH /api/v1/liabilities/{id}/actions/release` <core> tag=`Liability` :: Release liability
- `POST /api/v1/liabilities/{id}/documents` <core> tag=`Liability` :: Add file to liability
- `GET /api/v1/paymentMethods` <core> tag=`Payment Methods` :: List payment methods
- `GET /api/v1/paymentServiceProviders/{id}/transactions` <core> tag=`Payment Service Provider` :: List payment service provider transactions
- `POST /api/v1/paymentServiceProviders/{id}/transactions` <core> tag=`Payment Service Provider` :: Create payment service provider transactions
- `GET /api/v1/paymentTermsGroups` <core> tag=`Payment Terms Group` :: List payment terms groups
- `POST /api/v1/paymentTermsGroups` <core> tag=`Payment Terms Group` :: Create payment terms group
- `GET /api/v1/paymentTermsGroups/{id}` <core> tag=`Payment Terms Group` :: View payment terms group
- `GET /api/v1/paymentTransactions/{id}` <core> tag=`Payment Transaction` :: View payment transaction
- `PATCH /api/v1/paymentTransactions/{id}/status` <core> tag=`Payment Transaction` :: Update payment transaction status
- `PATCH /api/v2/invoices/{id}/actions/send` <core> tag=`Invoice` :: Send invoice V2
- `GET /api/v3/creditNotes` <v3> tag=`CreditNote` :: List credit notes V3
- `POST /api/v3/creditNotes` <v3> [B] tag=`CreditNote` :: 🔒 Create credit note V3
- `DELETE /api/v3/creditNotes/{id}` <v3> tag=`CreditNote` :: Delete credit note V3
- `GET /api/v3/creditNotes/{id}` <v3> tag=`CreditNote` :: View credit note V3
- `PATCH /api/v3/creditNotes/{id}` <v3> [B] tag=`CreditNote` :: 🔒 Update credit note V3
- `PATCH /api/v3/creditNotes/{id}/actions/logActivity` <v3> tag=`CreditNote` :: Log custom credit note activity V3
- `PATCH /api/v3/creditNotes/{id}/actions/release` <v3> tag=`CreditNote` :: Release credit note V3
- `PATCH /api/v3/creditNotes/{id}/actions/removeWriteProtection` <v3> tag=`CreditNote` :: Remove credit note write protection V3
- `PATCH /api/v3/creditNotes/{id}/actions/send` <v3> tag=`CreditNote` :: Send credit note V3
- `PATCH /api/v3/creditNotes/{id}/actions/setWriteProtection` <v3> tag=`CreditNote` :: Set credit note write protection V3
- `POST /api/v3/creditNotes/{id}/files` <v3> tag=`CreditNote` :: Attach file to credit note V3
- `DELETE /api/v3/creditNotes/{id}/files/{fileId}` <v3> tag=`CreditNote` :: Delete file from credit note V3
- `PATCH /api/v3/creditNotes/{id}/files/{fileId}` <v3> tag=`CreditNote` :: Update file on credit note V3
- `POST /api/v3/creditNotes/{id}/lineItems` <v3> [B] tag=`CreditNote` :: 🔒 Create credit note line item V3
- `DELETE /api/v3/creditNotes/{id}/lineItems/{lineItemId}` <v3> tag=`CreditNote` :: Delete credit note line item V3
- `GET /api/v3/creditNotes/{id}/lineItems/{lineItemId}` <v3> tag=`CreditNote` :: View credit note line item V3
- `PATCH /api/v3/creditNotes/{id}/lineItems/{lineItemId}` <v3> [B] tag=`CreditNote` :: 🔒 Update credit note line item V3
- `GET /api/v3/invoices` <v3> tag=`Invoice` :: List invoices V3
- `POST /api/v3/invoices` <v3> [B] tag=`Invoice` :: 🔒 Create invoice V3
- `POST /api/v3/invoices/actions/createFromDeliveryNote` <v3> [B] tag=`Invoice` :: 🔒 Create invoice from delivery note V3
- `POST /api/v3/invoices/actions/createFromSalesOrder` <v3> [B] tag=`Invoice` :: 🔒 Create invoice from sales order V3
- `DELETE /api/v3/invoices/{id}` <v3> tag=`Invoice` :: Delete invoice V3
- `GET /api/v3/invoices/{id}` <v3> tag=`Invoice` :: View invoice V3
- `PATCH /api/v3/invoices/{id}` <v3> [B] tag=`Invoice` :: 🔒 Update invoice V3
- `PATCH /api/v3/invoices/{id}/actions/logActivity` <v3> tag=`Invoice` :: Log custom invoice activity V3
- `PATCH /api/v3/invoices/{id}/actions/release` <v3> tag=`Invoice` :: Release invoice V3
- `PATCH /api/v3/invoices/{id}/actions/removeWriteProtection` <v3> tag=`Invoice` :: Remove invoice write protection V3
- `PATCH /api/v3/invoices/{id}/actions/send` <v3> tag=`Invoice` :: Send invoice V3
- `PATCH /api/v3/invoices/{id}/actions/setWriteProtection` <v3> tag=`Invoice` :: Set invoice write protection V3
- `POST /api/v3/invoices/{id}/files` <v3> tag=`Invoice` :: Attach file to invoice V3
- `DELETE /api/v3/invoices/{id}/files/{fileId}` <v3> tag=`Invoice` :: Delete file from invoice V3
- `PATCH /api/v3/invoices/{id}/files/{fileId}` <v3> tag=`Invoice` :: Update file on invoice V3
- `POST /api/v3/invoices/{id}/lineItems` <v3> [B] tag=`Invoice` :: 🔒 Create invoice line item V3
- `DELETE /api/v3/invoices/{id}/lineItems/{lineItemId}` <v3> tag=`Invoice` :: Delete invoice line item V3
- `GET /api/v3/invoices/{id}/lineItems/{lineItemId}` <v3> tag=`Invoice` :: View invoice line item V3
- `PATCH /api/v3/invoices/{id}/lineItems/{lineItemId}` <v3> [B] tag=`Invoice` :: 🔒 Update invoice line item V3
- `GET /api/v3/proformaInvoices` <v3> [B] tag=`ProformaInvoice` :: 🔒 List proforma invoices V3
- `POST /api/v3/proformaInvoices` <v3> [B] tag=`ProformaInvoice` :: 🔒 Create proforma invoice V3
- `DELETE /api/v3/proformaInvoices/{id}` <v3> tag=`ProformaInvoice` :: Delete proforma invoice V3
- `GET /api/v3/proformaInvoices/{id}` <v3> [B] tag=`ProformaInvoice` :: 🔒 View proforma invoice V3
- `PATCH /api/v3/proformaInvoices/{id}` <v3> [B] tag=`ProformaInvoice` :: 🔒 Update proforma invoice V3
- `PATCH /api/v3/proformaInvoices/{id}/actions/logActivity` <v3> tag=`ProformaInvoice` :: Log custom proforma invoice activity V3
- `PATCH /api/v3/proformaInvoices/{id}/actions/release` <v3> tag=`ProformaInvoice` :: Release proforma invoice V3
- `PATCH /api/v3/proformaInvoices/{id}/actions/removeWriteProtection` <v3> tag=`ProformaInvoice` :: Remove proforma invoice write protection V3
- `PATCH /api/v3/proformaInvoices/{id}/actions/send` <v3> tag=`ProformaInvoice` :: Send proforma invoice V3
- `PATCH /api/v3/proformaInvoices/{id}/actions/setWriteProtection` <v3> tag=`ProformaInvoice` :: Set proforma invoice write protection V3
- `POST /api/v3/proformaInvoices/{id}/files` <v3> tag=`ProformaInvoice` :: Attach file to proforma invoice V3
- `DELETE /api/v3/proformaInvoices/{id}/files/{fileId}` <v3> tag=`ProformaInvoice` :: Delete file from proforma invoice V3
- `PATCH /api/v3/proformaInvoices/{id}/files/{fileId}` <v3> tag=`ProformaInvoice` :: Update file on proforma invoice V3
- `POST /api/v3/proformaInvoices/{id}/lineItems` <v3> [B] tag=`ProformaInvoice` :: 🔒 Create proforma invoice line item V3
- `DELETE /api/v3/proformaInvoices/{id}/lineItems/{lineItemId}` <v3> tag=`ProformaInvoice` :: Delete proforma invoice line item V3
- `GET /api/v3/proformaInvoices/{id}/lineItems/{lineItemId}` <v3> tag=`ProformaInvoice` :: View proforma invoice line item V3
- `PATCH /api/v3/proformaInvoices/{id}/lineItems/{lineItemId}` <v3> [B] tag=`ProformaInvoice` :: 🔒 Update proforma invoice line item V3

## Fulfillment & Shipping (38 ops, 13 read)

- `GET /api/v1/deliveries` <core> tag=`Delivery` :: List deliveries
- `GET /api/v1/deliveries/{id}` <core> [D] tag=`Delivery` :: View delivery
- `GET /api/v1/deliveryNotes` <core> tag=`Delivery Note` :: List delivery notes
- `GET /api/v1/deliveryNotes/{id}` <core> tag=`Delivery Note` :: View delivery note
- `PATCH /api/v1/deliveryNotes/{id}/actions/assignQualityControlAttributes` <core> tag=`Delivery Note` :: Assign quality control attributes to delivery note
- `PATCH /api/v1/deliveryNotes/{id}/customsUpdate` <core> tag=`Delivery Note` :: Update delivery note positions customs data.
- `GET /api/v1/deliveryNotes/{id}/deliveries` <core> [D] tag=`Delivery Note` :: List delivery note deliveries
- `GET /api/v1/deliveryNotes/{id}/shipments` <core> tag=`Delivery Note` :: View delivery note shipments
- `GET /api/v1/deliveryNotesTags` <core> [D] tag=`Delivery Note Tag` :: List delivery notes tags
- `POST /api/v1/shipments` <core> tag=`Shipments` :: Create tracking information
- `GET /api/v1/shipments/{id}` <core> tag=`Delivery` :: View shipment
- `GET /api/v1/shippingMethods` <core> tag=`Shipping Methods` :: List shipping methods
- `POST /api/v1/shippingMethods` <core> tag=`Shipping Methods` :: Create shipping method
- `GET /api/v1/shippingMethods/{id}` <core> tag=`Shipping Methods` :: View shipping method
- `PUT /api/v1/shippingMethods/{id}` <core> tag=`Shipping Methods` :: Update shipping method
- `GET /api/v3/deliveryNotes` <v3> tag=`DeliveryNote` :: List delivery notes V3
- `POST /api/v3/deliveryNotes` <v3> [B] tag=`DeliveryNote` :: 🔒 Create delivery note V3
- `DELETE /api/v3/deliveryNotes/{id}` <v3> tag=`DeliveryNote` :: Delete delivery note V3
- `GET /api/v3/deliveryNotes/{id}` <v3> tag=`DeliveryNote` :: View delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}` <v3> [B] tag=`DeliveryNote` :: 🔒 Update delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/cancel` <v3> tag=`DeliveryNote` :: Cancel delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/complete` <v3> tag=`DeliveryNote` :: Complete delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/logActivity` <v3> tag=`DeliveryNote` :: Log custom delivery note activity V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/release` <v3> tag=`DeliveryNote` :: Release delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/removeWriteProtection` <v3> tag=`DeliveryNote` :: Remove delivery note write protection V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/send` <v3> tag=`DeliveryNote` :: Send delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}/actions/setWriteProtection` <v3> tag=`DeliveryNote` :: Set delivery note write protection V3
- `POST /api/v3/deliveryNotes/{id}/files` <v3> tag=`DeliveryNote` :: Attach file to delivery note V3
- `DELETE /api/v3/deliveryNotes/{id}/files/{fileId}` <v3> tag=`DeliveryNote` :: Delete file from delivery note V3
- `PATCH /api/v3/deliveryNotes/{id}/files/{fileId}` <v3> tag=`DeliveryNote` :: Update file on delivery note V3
- `POST /api/v3/deliveryNotes/{id}/lineItems` <v3> [B] tag=`DeliveryNote` :: 🔒 Create delivery note line item V3
- `DELETE /api/v3/deliveryNotes/{id}/lineItems/{lineItemId}` <v3> tag=`DeliveryNote` :: Delete delivery note line item V3
- `GET /api/v3/deliveryNotes/{id}/lineItems/{lineItemId}` <v3> tag=`DeliveryNote` :: View delivery note line item V3
- `PATCH /api/v3/deliveryNotes/{id}/lineItems/{lineItemId}` <v3> [B] tag=`DeliveryNote` :: 🔒 Update delivery note line item V3
- `POST /api/v3/products/{productId}/deliveryThresholds` <v3> tag=`ProductDeliveryThreshold` :: Create product delivery threshold V3
- `POST /api/v3/serviceOrders/{id}/files` <v3> tag=`ServiceOrder` :: Attach file to service order V3
- `DELETE /api/v3/serviceOrders/{id}/files/{fileId}` <v3> tag=`ServiceOrder` :: Delete file from service order V3
- `PATCH /api/v3/serviceOrders/{id}/files/{fileId}` <v3> tag=`ServiceOrder` :: Update file on service order V3

## Returns & Goods Receipt (33 ops, 9 read)

- `GET /api/v1/provisionalReturns` <core> tag=`Provisional Return` :: List provisional returns
- `POST /api/v1/purchaseOrders/{id}/goodsReceipts` <core> tag=`Goods Receipt` :: Create goods receipt for purchase order
- `GET /api/v1/returnReasons` <core> tag=`Return Reason` :: List return reasons
- `GET /api/v1/returns` <core> tag=`Return` :: List returns
- `POST /api/v1/returns` <core> tag=`Return` :: Create return
- `GET /api/v1/returns/{id}` <core> tag=`Return` :: View return
- `POST /api/v1/returns/{id}/actions/release` <core> tag=`Return` :: Release return
- `DELETE /api/v1/returns/{id}/documents` <core> tag=`Return` :: Delete multiple return documents
- `GET /api/v1/returns/{id}/documents` <core> [D] tag=`Return` :: List return documents
- `PATCH /api/v1/returns/{id}/documents` <core> tag=`Return` :: Update multiple return documents
- `POST /api/v1/returns/{id}/documents` <core> tag=`Return` :: Create return document
- `GET /api/v1/returns/{id}/documents/{documentId}` <core> [D] tag=`Return` :: View return document
- `POST /api/v1/returns/{id}/goodsReceipts` <core> tag=`Goods Receipt` :: Create goods receipt for return
- `GET /api/v3/returnOrders` <v3> tag=`ReturnOrder` :: List return orders V3
- `POST /api/v3/returnOrders` <v3> [B] tag=`ReturnOrder` :: 🔒 Create return order V3
- `POST /api/v3/returnOrders/actions/createFromDeliveryNote` <v3> [B] tag=`ReturnOrder` :: 🔒 Create return order from delivery note V3
- `DELETE /api/v3/returnOrders/{id}` <v3> tag=`ReturnOrder` :: Delete return order V3
- `GET /api/v3/returnOrders/{id}` <v3> tag=`ReturnOrder` :: View return order V3
- `PATCH /api/v3/returnOrders/{id}` <v3> [B] tag=`ReturnOrder` :: 🔒 Update return order V3
- `PATCH /api/v3/returnOrders/{id}/actions/cancel` <v3> tag=`ReturnOrder` :: Cancel return order V3
- `PATCH /api/v3/returnOrders/{id}/actions/complete` <v3> tag=`ReturnOrder` :: Complete return order V3
- `PATCH /api/v3/returnOrders/{id}/actions/logActivity` <v3> tag=`ReturnOrder` :: Log custom return order activity V3
- `PATCH /api/v3/returnOrders/{id}/actions/release` <v3> tag=`ReturnOrder` :: Release return order V3
- `PATCH /api/v3/returnOrders/{id}/actions/removeWriteProtection` <v3> tag=`ReturnOrder` :: Remove return order write protection V3
- `PATCH /api/v3/returnOrders/{id}/actions/send` <v3> tag=`ReturnOrder` :: Send return order V3
- `PATCH /api/v3/returnOrders/{id}/actions/setWriteProtection` <v3> tag=`ReturnOrder` :: Set return order write protection V3
- `POST /api/v3/returnOrders/{id}/files` <v3> tag=`ReturnOrder` :: Attach file to return order V3
- `DELETE /api/v3/returnOrders/{id}/files/{fileId}` <v3> tag=`ReturnOrder` :: Delete file from return order V3
- `PATCH /api/v3/returnOrders/{id}/files/{fileId}` <v3> tag=`ReturnOrder` :: Update file on return order V3
- `POST /api/v3/returnOrders/{id}/lineItems` <v3> [B] tag=`ReturnOrder` :: 🔒 Create return order line item V3
- `DELETE /api/v3/returnOrders/{id}/lineItems/{lineItemId}` <v3> tag=`ReturnOrder` :: Delete return order line item V3
- `GET /api/v3/returnOrders/{id}/lineItems/{lineItemId}` <v3> tag=`ReturnOrder` :: View return order line item V3
- `PATCH /api/v3/returnOrders/{id}/lineItems/{lineItemId}` <v3> [B] tag=`ReturnOrder` :: 🔒 Update return order line item V3

## Purchasing (38 ops, 8 read)

- `GET /api/v1/purchaseOrders` <core> tag=`Purchase Order` :: List purchase orders
- `POST /api/v1/purchaseOrders` <core> tag=`Purchase Order` :: Create purchase order
- `GET /api/v1/purchaseOrders/{id}` <core> tag=`Purchase Order` :: View purchase order
- `PATCH /api/v1/purchaseOrders/{id}` <core> tag=`Purchase Order` :: Update purchase order
- `PATCH /api/v1/purchaseOrders/{id}/actions/cancel` <core> tag=`Purchase Order` :: Cancel purchase order
- `PATCH /api/v1/purchaseOrders/{id}/actions/release` <core> tag=`Purchase Order` :: Release purchase order
- `GET /api/v1/purchasePrices` <core> [D] tag=`Purchase Price` :: List purchase prices V1
- `PATCH /api/v1/purchasePrices` <core> [D] tag=`Purchase Price` :: Update multiple purchase prices V1
- `POST /api/v1/purchasePrices` <core> [D] tag=`Purchase Price` :: Create purchase price V1
- `DELETE /api/v1/purchasePrices/{id}` <core> tag=`Purchase Price` :: Delete purchase price
- `GET /api/v1/purchasePrices/{id}` <core> tag=`Purchase Price` :: View purchase price
- `PATCH /api/v1/purchasePrices/{id}` <core> [D] tag=`Purchase Price` :: Update purchase price V1
- `GET /api/v2/purchasePrices` <core> tag=`Purchase Price` :: List purchase prices V2
- `PATCH /api/v2/purchasePrices` <core> tag=`Purchase Price` :: Update multiple purchase prices V2
- `POST /api/v2/purchasePrices` <core> tag=`Purchase Price` :: Create purchase price V2
- `PATCH /api/v2/purchasePrices/{id}` <core> tag=`Purchase Price` :: Update purchase price V2
- `GET /api/v3/purchaseOrders` <v3> tag=`PurchaseOrder` :: List purchase orders V3
- `POST /api/v3/purchaseOrders` <v3> [B] tag=`PurchaseOrder` :: 🔒 Create purchase order V3
- `DELETE /api/v3/purchaseOrders/{id}` <v3> tag=`PurchaseOrder` :: Delete purchase order V3
- `GET /api/v3/purchaseOrders/{id}` <v3> tag=`PurchaseOrder` :: View purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}` <v3> [B] tag=`PurchaseOrder` :: 🔒 Update purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/cancel` <v3> tag=`PurchaseOrder` :: Cancel purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/complete` <v3> tag=`PurchaseOrder` :: Complete purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/logActivity` <v3> tag=`PurchaseOrder` :: Log custom purchase order activity V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/release` <v3> tag=`PurchaseOrder` :: Release purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/removeWriteProtection` <v3> tag=`PurchaseOrder` :: Remove purchase order write protection V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/send` <v3> tag=`PurchaseOrder` :: Send purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}/actions/setWriteProtection` <v3> tag=`PurchaseOrder` :: Set purchase order write protection V3
- `POST /api/v3/purchaseOrders/{id}/files` <v3> tag=`PurchaseOrder` :: Attach file to purchase order V3
- `DELETE /api/v3/purchaseOrders/{id}/files/{fileId}` <v3> tag=`PurchaseOrder` :: Delete file from purchase order V3
- `PATCH /api/v3/purchaseOrders/{id}/files/{fileId}` <v3> tag=`PurchaseOrder` :: Update file on purchase order V3
- `POST /api/v3/purchaseOrders/{id}/lineItems` <v3> [B] tag=`PurchaseOrder` :: 🔒 Create purchase order line item V3
- `DELETE /api/v3/purchaseOrders/{id}/lineItems/{lineItemId}` <v3> tag=`PurchaseOrder` :: Delete purchase order line item V3
- `GET /api/v3/purchaseOrders/{id}/lineItems/{lineItemId}` <v3> tag=`PurchaseOrder` :: View purchase order line item V3
- `PATCH /api/v3/purchaseOrders/{id}/lineItems/{lineItemId}` <v3> [B] tag=`PurchaseOrder` :: 🔒 Update purchase order line item V3
- `POST /api/v3/supplierInvoices/{id}/files` <v3> tag=`SupplierInvoice` :: Attach file to supplier invoice V3
- `DELETE /api/v3/supplierInvoices/{id}/files/{fileId}` <v3> tag=`SupplierInvoice` :: Delete file from supplier invoice V3
- `PATCH /api/v3/supplierInvoices/{id}/files/{fileId}` <v3> tag=`SupplierInvoice` :: Update file on supplier invoice V3

## Inventory & Warehouse (28 ops, 8 read)

- `GET /api/v1/productions` <core> tag=`Production` :: List productions
- `GET /api/v1/productions/{id}` <core> tag=`Production` :: View production
- `PATCH /api/v1/productions/{id}/actions/cancel` <core> tag=`Production` :: Cancel production
- `PATCH /api/v1/productions/{id}/actions/release` <core> tag=`Production` :: Release production
- `POST /api/v1/stockMovementTypes` <core> tag=`Stock Movement Types` :: Create stock movement type
- `PATCH /api/v1/storageLocations/setTotalStock` <core> tag=`Storage Location` :: Set total stock on storage locations
- `GET /api/v1/warehouses` <core> [B] tag=`Warehouse` :: List warehouses
- `POST /api/v1/warehouses` <core> tag=`Warehouse` :: Create warehouse
- `DELETE /api/v1/warehouses/{id}` <core> tag=`Warehouse` :: Delete warehouse
- `PATCH /api/v1/warehouses/{id}` <core> tag=`Warehouse` :: Update warehouse
- `GET /api/v1/warehouses/{warehouseId}/storageLocations` <core> [B] tag=`Storage Location` :: List storage locations
- `POST /api/v1/warehouses/{warehouseId}/storageLocations` <core> tag=`Storage Location` :: Create storage location
- `DELETE /api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}` <core> tag=`Storage Location` :: Delete storage location
- `PATCH /api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}` <core> tag=`Storage Location` :: Update storage location
- `GET /api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items` <core> [D] tag=`Storage Item` :: List storage items V1
- `PATCH /api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items` <core> tag=`Storage Item` :: Retrieve item from storage location
- `POST /api/v1/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items` <core> tag=`Storage Item` :: Add item to storage location
- `GET /api/v2/warehouses/{warehouseId}/storageLocations/{storageLocationId}/items` <core> tag=`Storage Item` :: List storage items V2
- `GET /api/v3/productions` <v3> [B] tag=`Production` :: 🔒 List productions V3
- `POST /api/v3/productions` <v3> [B] tag=`Production` :: 🔒 Create production V3
- `DELETE /api/v3/productions/{id}` <v3> tag=`Production` :: Delete production V3
- `GET /api/v3/productions/{id}` <v3> [B] tag=`Production` :: 🔒 View production V3
- `PATCH /api/v3/productions/{id}/actions/logActivity` <v3> tag=`Production` :: Log custom production activity V3
- `PATCH /api/v3/productions/{id}/actions/release` <v3> tag=`Production` :: Release production V3
- `PATCH /api/v3/productions/{id}/actions/start` <v3> tag=`Production` :: Start production V3
- `POST /api/v3/productions/{id}/files` <v3> tag=`Production` :: Attach file to production V3
- `DELETE /api/v3/productions/{id}/files/{fileId}` <v3> tag=`Production` :: Delete file from production V3
- `PATCH /api/v3/productions/{id}/files/{fileId}` <v3> tag=`Production` :: Update file on production V3

## Customers (30 ops, 12 read)

- `GET /api/v1/customers/{customerId}/contactPerson` <core> tag=`Customer - Contact Person` :: List contact persons
- `POST /api/v1/customers/{customerId}/contactPerson` <core> tag=`Customer - Contact Person` :: Create contact person
- `DELETE /api/v1/customers/{customerId}/contactPerson/{contactPersonId}` <core> tag=`Customer - Contact Person` :: Delete contact person
- `GET /api/v1/customers/{customerId}/contactPerson/{contactPersonId}` <core> tag=`Customer - Contact Person` :: View contact person
- `PATCH /api/v1/customers/{customerId}/contactPerson/{contactPersonId}` <core> tag=`Customer - Contact Person` :: Update contact person
- `DELETE /api/v1/customers/{id}` <core> tag=`Customer` :: Delete customer
- `GET /api/v2/customers` <core> tag=`Customer` :: List customers
- `POST /api/v2/customers` <core> tag=`Customer` :: Create customer
- `GET /api/v2/customers/{customerId}/addresses` <core> tag=`Customer Address` :: List addresses
- `POST /api/v2/customers/{customerId}/addresses` <core> tag=`Customer Address` :: Create address
- `DELETE /api/v2/customers/{customerId}/addresses/{id}` <core> tag=`Customer Address` :: Delete address
- `GET /api/v2/customers/{customerId}/addresses/{id}` <core> tag=`Customer Address` :: View address
- `PATCH /api/v2/customers/{customerId}/addresses/{id}` <core> tag=`Customer Address` :: Update address
- `GET /api/v2/customers/{id}` <core> tag=`Customer` :: View customer
- `PATCH /api/v2/customers/{id}` <core> tag=`Customer` :: Update customer
- `GET /api/v3/customers` <v3> [B] tag=`Customer` :: 🔒 List customers V3
- `POST /api/v3/customers` <v3> [B] tag=`Customer` :: 🔒 Create customer V3
- `GET /api/v3/customers/{customerId}/contactPersons` <v3> [B] tag=`Customer` :: 🔒 List contact persons V3
- `POST /api/v3/customers/{customerId}/contactPersons` <v3> [B] tag=`Customer` :: 🔒 Create contact person V3
- `DELETE /api/v3/customers/{customerId}/contactPersons/{contactPersonId}` <v3> [B] tag=`Customer` :: 🔒 Delete contact person V3
- `GET /api/v3/customers/{customerId}/contactPersons/{contactPersonId}` <v3> [B] tag=`Customer` :: 🔒 View contact person V3
- `PATCH /api/v3/customers/{customerId}/contactPersons/{contactPersonId}` <v3> [B] tag=`Customer` :: 🔒 Update contact person V3
- `GET /api/v3/customers/{customerId}/deliveryAddresses` <v3> [B] tag=`Customer Delivery Address` :: 🔒 Paginated list of delivery addresses for a customer V3
- `POST /api/v3/customers/{customerId}/deliveryAddresses` <v3> [B] tag=`Customer Delivery Address` :: 🔒 Create delivery address V3
- `DELETE /api/v3/customers/{customerId}/deliveryAddresses/{deliveryAddressId}` <v3> [B] tag=`Customer Delivery Address` :: 🔒 Delete delivery address V3
- `GET /api/v3/customers/{customerId}/deliveryAddresses/{deliveryAddressId}` <v3> [B] tag=`Customer Delivery Address` :: 🔒 View delivery address V3
- `PATCH /api/v3/customers/{customerId}/deliveryAddresses/{deliveryAddressId}` <v3> [B] tag=`Customer Delivery Address` :: 🔒 Update delivery address V3
- `DELETE /api/v3/customers/{id}` <v3> [B] tag=`Customer` :: 🔒 Delete customer V3
- `GET /api/v3/customers/{id}` <v3> [B] tag=`Customer` :: 🔒 View customer V3
- `PATCH /api/v3/customers/{id}` <v3> [B] tag=`Customer` :: 🔒 Update customer V3

## Suppliers (21 ops, 9 read)

- `GET /api/v1/suppliers` <core> tag=`Supplier` :: List suppliers
- `PATCH /api/v1/suppliers` <core> [D] tag=`Supplier` :: Update multiple suppliers tags
- `DELETE /api/v1/suppliers/{id}` <core> tag=`Supplier` :: Delete supplier
- `GET /api/v1/suppliers/{id}` <core> tag=`Supplier` :: View supplier
- `PATCH /api/v1/suppliers/{id}` <core> [D] tag=`Supplier` :: Update single Supplier tags
- `GET /api/v1/suppliersTags` <core> [D] tag=`Supplier Tag` :: List suppliers tags
- `GET /api/v3/suppliers` <v3> [B] tag=`Supplier` :: 🔒 List suppliers V3
- `POST /api/v3/suppliers` <v3> [B] tag=`Supplier` :: 🔒 Create supplier V3
- `DELETE /api/v3/suppliers/{id}` <v3> [B] tag=`Supplier` :: 🔒 Delete supplier V3
- `GET /api/v3/suppliers/{id}` <v3> [B] tag=`Supplier` :: 🔒 View supplier V3
- `PATCH /api/v3/suppliers/{id}` <v3> [B] tag=`Supplier` :: 🔒 Update supplier V3
- `GET /api/v3/suppliers/{supplierId}/contactPersons` <v3> [B] tag=`Supplier` :: 🔒 List contact persons V3
- `POST /api/v3/suppliers/{supplierId}/contactPersons` <v3> [B] tag=`Supplier` :: 🔒 Create contact person V3
- `DELETE /api/v3/suppliers/{supplierId}/contactPersons/{contactPersonId}` <v3> [B] tag=`Supplier` :: 🔒 Delete contact person V3
- `GET /api/v3/suppliers/{supplierId}/contactPersons/{contactPersonId}` <v3> [B] tag=`Supplier` :: 🔒 View contact person V3
- `PATCH /api/v3/suppliers/{supplierId}/contactPersons/{contactPersonId}` <v3> [B] tag=`Supplier` :: 🔒 Update contact person V3
- `GET /api/v3/suppliers/{supplierId}/deliveryAddresses` <v3> [B] tag=`Supplier Delivery Address` :: 🔒 List supplier delivery addresses V3
- `POST /api/v3/suppliers/{supplierId}/deliveryAddresses` <v3> [B] tag=`Supplier Delivery Address` :: 🔒 Create delivery address V3
- `DELETE /api/v3/suppliers/{supplierId}/deliveryAddresses/{deliveryAddressId}` <v3> [B] tag=`Supplier Delivery Address` :: 🔒 Delete delivery address V3
- `GET /api/v3/suppliers/{supplierId}/deliveryAddresses/{deliveryAddressId}` <v3> [B] tag=`Supplier Delivery Address` :: 🔒 View delivery address V3
- `PATCH /api/v3/suppliers/{supplierId}/deliveryAddresses/{deliveryAddressId}` <v3> [B] tag=`Supplier Delivery Address` :: 🔒 Update delivery address V3

## Products (80 ops, 33 read)

- `DELETE /api/v1/productMedia` <core> tag=`Product Media` :: Delete multiple product media
- `GET /api/v1/productMedia` <core> tag=`Product Media` :: List product media
- `PATCH /api/v1/productMedia` <core> tag=`Product Media` :: Update multiple product media
- `POST /api/v1/productMedia` <core> tag=`Product Media` :: Create product media
- `GET /api/v1/productMedia/{id}` <core> tag=`Product Media` :: View product media
- `POST /api/v1/productMedia/{id}/versions` <core> tag=`Product Media` :: Create product media version
- `DELETE /api/v1/productMedia/{id}/versions/{version}` <core> tag=`Product Media` :: Delete product media version
- `GET /api/v1/productMedia/{id}/versions/{version}` <core> tag=`Product Media` :: View product media version
- `PATCH /api/v1/productMedia/{id}/versions/{version}` <core> tag=`Product Media` :: Update product media version
- `DELETE /api/v1/products` <core> tag=`Product` :: Delete multiple products
- `GET /api/v1/products` <core> [D] tag=`Product` :: List products V1
- `PATCH /api/v1/products` <core> [D] tag=`Product` :: Update multiple products V1
- `POST /api/v1/products` <core> [D] tag=`Product` :: Create new product V1
- `GET /api/v1/products/actions/identify` <core> [D] tag=`Product` :: Identify product
- `DELETE /api/v1/products/{id}` <core> tag=`Product` :: Delete product
- `GET /api/v1/products/{id}` <core> [D] tag=`Product` :: View product v1
- `PATCH /api/v1/products/{id}` <core> [D] tag=`Product` :: Update product v1
- `POST /api/v1/products/{id}/actions/createVariants` <core> tag=`Product` :: Creates variants for a matrix product
- `DELETE /api/v1/products/{id}/crossSelling` <core> tag=`Product` :: Delete cross selling
- `GET /api/v1/products/{id}/crossSelling` <core> tag=`Product` :: List cross sellings
- `PATCH /api/v1/products/{id}/crossSelling` <core> tag=`Product` :: Update cross selling
- `POST /api/v1/products/{id}/crossSelling` <core> tag=`Product` :: Create cross selling
- `GET /api/v1/products/{id}/media` <core> [D] tag=`Product` :: View media
- `DELETE /api/v1/products/{id}/options` <core> tag=`Matrixproduct` :: Delete multiple product options
- `GET /api/v1/products/{id}/options` <core> tag=`Matrixproduct` :: List product options
- `PATCH /api/v1/products/{id}/options` <core> tag=`Matrixproduct` :: Update multiple product options
- `POST /api/v1/products/{id}/options` <core> tag=`Matrixproduct` :: Create product option
- `DELETE /api/v1/products/{id}/parts` <core> tag=`Product` :: Delete parts
- `GET /api/v1/products/{id}/parts` <core> tag=`Product` :: List parts
- `PATCH /api/v1/products/{id}/parts` <core> [D] tag=`Product` :: Update parts v1
- `POST /api/v1/products/{id}/parts` <core> [D] tag=`Product` :: Create parts v1
- `GET /api/v1/products/{id}/printLabel` <core> tag=`Product Label` :: Download product label as pdf
- `POST /api/v1/products/{id}/printLabel` <core> tag=`Product Label` :: Print product label
- `GET /api/v1/products/{id}/productionsPositions` <core> tag=`Product` :: View productions positions
- `GET /api/v1/products/{id}/properties` <core> tag=`Product` :: List product properties
- `PATCH /api/v1/products/{id}/properties` <core> tag=`Product` :: Update product properties
- `GET /api/v1/products/{id}/purchaseOrdersPositions` <core> tag=`Product` :: View purchase orders positions
- `GET /api/v1/products/{id}/purchasePrices` <core> tag=`Product` :: View purchase prices
- `GET /api/v1/products/{id}/reservations` <core> tag=`Product` :: View reservations
- `GET /api/v1/products/{id}/salesOrdersPositions` <core> tag=`Product` :: View sales orders positions
- `GET /api/v1/products/{id}/salesPrices` <core> tag=`Product` :: View sales prices
- `GET /api/v1/products/{id}/stocks` <core> tag=`Product` :: View stock details of a product
- `GET /api/v1/products/{id}/storageLocations` <core> tag=`Product` :: View storage locations
- `GET /api/v1/products/{id}/texts` <core> tag=`Product` :: List product texts
- `PATCH /api/v1/products/{id}/updateAccountMapping` <core> tag=`Product` :: Update account mapping
- `PATCH /api/v1/products/{productId}/options/{id}` <core> tag=`Matrixproduct` :: Update product option
- `DELETE /api/v1/products/{productId}/options/{id}/values` <core> tag=`Matrixproduct` :: Delete multiple product option values
- `GET /api/v1/products/{productId}/options/{id}/values` <core> tag=`Matrixproduct` :: List product option values
- `POST /api/v1/products/{productId}/options/{id}/values` <core> tag=`Matrixproduct` :: Create multiple product option values
- `DELETE /api/v1/products/{productId}/options/{optionId}/values/{id}` <core> tag=`Matrixproduct` :: Delete product option value
- `GET /api/v1/products/{productId}/options/{optionId}/values/{id}` <core> tag=`Matrixproduct` :: View product option value
- `PATCH /api/v1/products/{productId}/options/{optionId}/values/{id}` <core> tag=`Matrixproduct` :: Update product option value
- `GET /api/v1/productsCategories` <core> tag=`Product Category` :: List product categories
- `POST /api/v1/productsCategories` <core> tag=`Product Category` :: Create product category
- `DELETE /api/v1/productsCategories/{id}` <core> tag=`Product Category` :: Delete product category
- `GET /api/v1/productsCategories/{id}` <core> tag=`Product Category` :: View product category
- `PATCH /api/v1/productsCategories/{id}` <core> tag=`Product Category` :: Update product category
- `GET /api/v1/productsFreeFields` <core> tag=`Product Free Field` :: List product free fields
- `PATCH /api/v1/productsFreeFields` <core> tag=`Product Free Field` :: Update multiple product free fields
- `GET /api/v1/productsFreeFields/{id}` <core> tag=`Product Free Field` :: View product free field
- `PATCH /api/v1/productsFreeFields/{id}` <core> tag=`Product Free Field` :: Update product free field
- `GET /api/v1/productsMerchandiseGroups` <core> tag=`Product Merchandise Group` :: List product merchandise groups
- `POST /api/v1/productsMerchandiseGroups` <core> tag=`Product Merchandise Group` :: Create product merchandise group
- `DELETE /api/v1/productsMerchandiseGroups/{id}` <core> tag=`Product Merchandise Group` :: Delete product merchandise group
- `GET /api/v1/productsMerchandiseGroups/{id}` <core> tag=`Product Merchandise Group` :: View product merchandise group
- `PATCH /api/v1/productsMerchandiseGroups/{id}` <core> tag=`Product Merchandise Group` :: Update product merchandise group
- `DELETE /api/v1/productsProperties` <core> tag=`Product Property` :: Delete multiple product properties
- `GET /api/v1/productsProperties` <core> tag=`Product Property` :: List product properties
- `PATCH /api/v1/productsProperties` <core> tag=`Product Property` :: Update multiple product properties
- `POST /api/v1/productsProperties` <core> tag=`Product Property` :: Create multiple product properties
- `GET /api/v1/productsTags` <core> [D] tag=`Product Tag` :: List product tags
- `POST /api/v1/productsTags` <core> [D] tag=`Product Tag` :: Create product tag
- `PATCH /api/v1/productsTags/{id}` <core> [D] tag=`Product Tag` :: Update product tag
- `GET /api/v2/products` <core> tag=`Product` :: List products V2
- `PATCH /api/v2/products` <core> tag=`Product` :: Update multiple products V2
- `POST /api/v2/products` <core> tag=`Product` :: Create product V2
- `GET /api/v2/products/{id}` <core> tag=`Product` :: View product V2
- `PATCH /api/v2/products/{id}` <core> tag=`Product` :: Update product v2
- `PATCH /api/v2/products/{id}/parts` <core> tag=`Product` :: Update parts v2
- `POST /api/v2/products/{id}/parts` <core> tag=`Product` :: Create parts v2

## Accounting & Tax (42 ops, 21 read)

- `GET /api/v1/account` <core> [B] tag=`Account` :: 🔒 List Account Entries
- `POST /api/v1/account` <core> [B] tag=`Account` :: 🔒 Create account
- `DELETE /api/v1/account/{id}` <core> [B] tag=`Account` :: 🔒 Delete Account Entry by ID
- `GET /api/v1/account/{id}` <core> [B] tag=`Account` :: 🔒 Get Account Entry by ID
- `PATCH /api/v1/account/{id}` <core> [B] tag=`Account` :: 🔒 Update account
- `POST /api/v1/accounting/datev/csvExport/accountTransactions` <core> tag=`Accounting Export` :: Execute the accounting CSV export for account transactions
- `POST /api/v1/accounting/datev/csvExport/invoicesAndCreditNotes` <core> tag=`Accounting Export` :: Execute the accounting CSV export for invoices and credit notes
- `POST /api/v1/accounting/datev/csvExport/liabilities` <core> tag=`Accounting Export` :: Execute the accounting CSV export for liabilities
- `POST /api/v1/accounting/datev/xmlExport/creditNotes` <core> tag=`Accounting Export` :: Execute the accounting XML export for credit notes
- `POST /api/v1/accounting/datev/xmlExport/invoices` <core> tag=`Accounting Export` :: Execute the accounting XML export for invoices
- `POST /api/v1/accounting/datev/xmlExport/liabilities` <core> tag=`Accounting Export` :: Execute the accounting XML export for liabilities
- `GET /api/v1/accounting/downloads/{downloadKey}` <core> tag=`Accounting Export` :: Download accounting export
- `GET /api/v1/accounting/downloads/{downloadKey}/status` <core> tag=`Accounting Export` :: Check accounting export status
- `GET /api/v1/generalLedger` <core> [B] tag=`General Ledger` :: 🔒 List General Ledger Entries
- `GET /api/v1/generalLedger/{id}` <core> [B] tag=`General Ledger` :: 🔒 Get General Ledger Entry by ID
- `GET /api/v1/generalLedgerAggAccountView` <core> [B] tag=`General Ledger` :: 🔒 List General Ledger Entries With Aggregated Account
- `GET /api/v1/generalLedgerAggDocumentView` <core> [B] tag=`General Ledger` :: 🔒 List General Ledger Entries With Aggregated Document
- `GET /api/v1/generalLedgerAggLineItemView` <core> [B] tag=`General Ledger` :: 🔒 List General Ledger Entries With Aggregated Line Item
- `GET /api/v1/revenueAccountMapping` <core> [B] tag=`Revenue Account Mapping` :: 🔒 List Revenue Account Mapping Entries
- `POST /api/v1/revenueAccountMapping` <core> [B] tag=`Revenue Account Mapping` :: 🔒 Create revenue account mapping
- `DELETE /api/v1/revenueAccountMapping/{id}` <core> [B] tag=`Revenue Account Mapping` :: 🔒 Delete Revenue Account Mapping Entry by ID
- `GET /api/v1/revenueAccountMapping/{id}` <core> [B] tag=`Revenue Account Mapping` :: 🔒 Get Revenue Account Mapping Entry by ID
- `PATCH /api/v1/revenueAccountMapping/{id}` <core> [B] tag=`Revenue Account Mapping` :: 🔒 Update revenue account mapping
- `GET /api/v1/tax` <core> [B] tag=`Tax` :: 🔒 List Tax Entries
- `POST /api/v1/tax` <core> [B] tag=`Tax` :: 🔒 Create tax
- `GET /api/v1/tax/{id}` <core> [B] tag=`Tax` :: 🔒 Get Tax Entry by ID
- `PATCH /api/v1/tax/{id}` <core> [B] tag=`Tax` :: 🔒 Update tax
- `GET /api/v1/taxAccountMapping` <core> [B] tag=`Tax Account Mapping` :: 🔒 List Tax Account Mapping Entries
- `POST /api/v1/taxAccountMapping` <core> [B] tag=`Tax Account Mapping` :: 🔒 Create tax account mapping
- `DELETE /api/v1/taxAccountMapping/{id}` <core> [B] tag=`Tax Account Mapping` :: 🔒 Delete Tax Account Mapping Entry by ID
- `GET /api/v1/taxAccountMapping/{id}` <core> [B] tag=`Tax Account Mapping` :: 🔒 Get Tax Account Mapping Entry by ID
- `PATCH /api/v1/taxAccountMapping/{id}` <core> [B] tag=`Tax Account Mapping` :: 🔒 Update tax account mapping
- `GET /api/v1/taxObligation` <core> [B] tag=`Tax Obligation` :: 🔒 List Tax Obligation Entries
- `POST /api/v1/taxObligation` <core> [B] tag=`Tax Obligation` :: 🔒 Create tax obligation
- `GET /api/v1/taxRates/{countryCode}` <core> tag=`Tax Rate` :: List tax rates
- `GET /api/v1/taxType` <core> [B] tag=`Tax Type` :: 🔒 List Tax Type Entries
- `POST /api/v1/taxType` <core> [B] tag=`Tax Type` :: 🔒 Create tax type
- `DELETE /api/v1/taxType/{id}` <core> [B] tag=`Tax Type` :: 🔒 Delete Tax Type Entry by ID
- `GET /api/v1/taxType/{id}` <core> [B] tag=`Tax Type` :: 🔒 Get Tax Type Entry by ID
- `PATCH /api/v1/taxType/{id}` <core> [B] tag=`Tax Type` :: 🔒 Update tax type
- `GET /api/v1/taxTypeMapping/extendedDetail` <core> [B] tag=`Tax Type Mapping` :: 🔒 List Tax Type Mapping Entries with Extended Detail
- `GET /api/v1/taxTypeMapping/{id}/extendedDetail` <core> [B] tag=`Tax Type Mapping` :: 🔒 Get Tax Type Mapping Entry with Extended Detail by ID

## Analytics & Reporting (25 ops, 12 read)

- `POST /api/v1/analytics/query` <core> tag=`Query` :: Execute query
- `GET /api/v1/analytics/query/export` <core> tag=`Query` :: List query exports
- `POST /api/v1/analytics/query/export` <core> tag=`Query` :: Create query export
- `GET /api/v1/analytics/query/export/{uuid}` <core> tag=`Query` :: View query export
- `GET /api/v1/analytics/report` <core> tag=`Report` :: List reports
- `POST /api/v1/analytics/report` <core> tag=`Report` :: Create report
- `DELETE /api/v1/analytics/report/{id}` <core> tag=`Report` :: Delete report
- `GET /api/v1/analytics/report/{id}` <core> tag=`Report` :: View report
- `PATCH /api/v1/analytics/report/{id}` <core> tag=`Report` :: Update report
- `GET /api/v1/analytics/report/{id}/export` <core> tag=`Report` :: List report exports
- `POST /api/v1/analytics/report/{id}/export` <core> tag=`Report` :: Create report export
- `GET /api/v1/analytics/report/{id}/export/{uuid}` <core> tag=`Report` :: View report export
- `DELETE /api/v1/analytics/report/{id}/permalink` <core> tag=`Report` :: Invalidate permalink for report
- `GET /api/v1/analytics/report/{id}/permalink` <core> tag=`Report` :: List report permalink
- `POST /api/v1/analytics/report/{id}/permalink` <core> tag=`Report` :: Create report permalink
- `GET /api/v1/analytics/report/{id}/permalink/{token}` <core> tag=`Report` :: Download report
- `POST /api/v1/analytics/report/{id}/query` <core> tag=`Report` :: Execute report query
- `GET /api/v1/analytics/report/{id}/schedule` <core> tag=`Report` :: List report schedules
- `POST /api/v1/analytics/report/{id}/schedule` <core> tag=`Report` :: Create report schedule
- `DELETE /api/v1/analytics/report/{id}/schedule/{uuid}` <core> tag=`Report` :: Delete report schedule
- `PATCH /api/v1/analytics/report/{id}/schedule/{uuid}` <core> tag=`Report` :: Update report schedule
- `GET /api/v1/analytics/reportUsage` <core> tag=`Report Usage` :: Get report usage
- `GET /api/v1/analytics/schedule` <core> tag=`Report` :: List schedules
- `GET /api/v1/analytics/settings` <core> tag=`Reporting Settings` :: Get settings
- `PATCH /api/v1/analytics/settings` <core> tag=`Reporting Settings` :: Update reporting settings

## Point of Sale (8 ops, 3 read)

- `GET /api/v1/cashRegisters/{id}/balance` <core> tag=`Point Of Sale` :: View cash register balance
- `GET /api/v1/cashiers` <core> tag=`Point Of Sale` :: List cashiers
- `POST /api/v1/cashiers/{id}/pinCheck` <core> tag=`Point Of Sale` :: Cashier PIN check
- `POST /api/v1/posCashCount/actions/add` <core> tag=`Point Of Sale` :: Add cash count entry
- `GET /api/v1/posJournals` <core> tag=`Point Of Sale` :: List POS journals
- `POST /api/v1/posJournals/actions/add` <core> tag=`Point Of Sale` :: Add journal entry
- `POST /api/v1/posQrCode/actions/add` <core> tag=`Point Of Sale` :: Add qr code data to a document
- `POST /api/v1/printJobs` <core> tag=`Print Jobs` :: Create print job

## Users, Auth & Employees (11 ops, 6 read)

- `POST /api/v1/auth-platform/token-exchange` <core> tag=`AuthPlatform` :: Exchange subject token for platform access token
- `GET /api/v1/employees` <core> tag=`Employee` :: List employees
- `GET /api/v1/users` <core> [D] tag=`User` :: List users
- `POST /api/v1/users` <core> tag=`User` :: Create user
- `DELETE /api/v1/users/{id}` <core> tag=`User` :: Delete user
- `GET /api/v1/users/{id}` <core> tag=`User` :: View user
- `PATCH /api/v1/users/{id}` <core> tag=`User` :: Update user
- `GET /api/v1/users/{id}/actions/downloadPermissions` <core> tag=`User` :: Download user permissions
- `GET /api/v1/users/{id}/permissions` <core> tag=`User` :: List user permissions
- `POST /api/v1/users/{id}/resetPassword/request` <core> tag=`User` :: Request reset password email
- `GET /api/v2/users` <core> tag=`User` :: List users V2

## Platform & Meta (27 ops, 13 read)

- `GET /api/v1/analytics/documentation` <core> tag=`Documentation` :: List documentations
- `GET /api/v1/externalReferenceTargets` <core> tag=`External Reference Target` :: List external reference targets
- `DELETE /api/v1/products/{id}/externalReferences` <core> tag=`External Reference` :: Delete external reference
- `GET /api/v1/products/{id}/externalReferences` <core> tag=`External Reference` :: List external references
- `PATCH /api/v1/products/{id}/externalReferences` <core> tag=`External Reference` :: Update external reference
- `POST /api/v1/products/{id}/externalReferences` <core> tag=`External Reference` :: Create external reference
- `GET /api/v1/projects` <core> tag=`Project` :: List projects
- `GET /api/v1/projects/{id}/posSettings` <core> tag=`Project` :: List POS settings for project
- `GET /api/v1/webhookEventTypes` <core> tag=`Webhook` :: List webhook event types
- `GET /api/v1/webhooks` <core> tag=`Webhook` :: List webhooks
- `POST /api/v1/webhooks` <core> tag=`Webhook` :: Create webhook
- `DELETE /api/v1/webhooks/{id}` <core> tag=`Webhook` :: Delete webhook
- `GET /api/v1/webhooks/{id}` <core> tag=`Webhook` :: View webhook
- `PATCH /api/v1/webhooks/{id}` <core> tag=`Webhook` :: Update webhook
- `GET /api/v2/settings/masterdata/addressCustomFields` <core> tag=`Setting` :: List address free fields
- `POST /api/v2/settings/masterdata/addressCustomFields` <core> tag=`Setting` :: Create address free field
- `GET /api/v2/settings/text-templates` <core> tag=`Setting` :: List text templates
- `PATCH /api/v2/settings/text-templates` <core> tag=`Setting` :: Update text templates
- `DELETE /api/v2/tags` <core> tag=`Tag` :: Delete tags
- `GET /api/v2/tags` <core> tag=`Tag` :: List tags
- `PATCH /api/v2/tags` <core> tag=`Tag` :: Update multiple tags
- `POST /api/v2/tags` <core> tag=`Tag` :: Create a new tag
- `GET /api/v2/{documentType}/{id}/files` <core> tag=`File` :: List files for a document
- `GET /api/v2/{documentType}/{id}/files/{fileId}` <core> tag=`File` :: View file of a document by id
- `DELETE /api/v2/{resource}TagAssignments` <core> tag=`Tag` :: Remove tags from multiple resources
- `POST /api/v2/{resource}TagAssignments` <core> tag=`Tag` :: Assign tags to multiple resources
- `PATCH /api/v3/emailAccounts/{id}/actions/sendEmail` <v3> tag=`EmailAccount` :: Send email via email account V3
