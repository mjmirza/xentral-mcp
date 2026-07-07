# xentral-mcp

Talk to your Xentral ERP in plain language from Claude and other MCP clients. Ask for a customer, a product, an open invoice, or a sales order, and get the answer back without opening the Xentral UI or writing an API call.

![License](https://img.shields.io/github/license/mjmirza/xentral-mcp)
![Version](https://img.shields.io/github/package-json/v/mjmirza/xentral-mcp)
![Node](https://img.shields.io/badge/node-%3E%3D18.18-brightgreen)

## What you get

- Answers from your live ERP inside your AI client. "Show me the last five sales orders" returns real rows, no tab switching.
- Read by default, with a guarded write path. Writes are off until you turn them on, so an agent can look but changes nothing until you allow it.
- Correct paths, not guessed ones. Every tool points at a verified endpoint from the Xentral OpenAPI specs, including the traps a naive build gets wrong (delivery notes, not the shipment level `deliveries` path).
- Reach any of 548 operations. 24 tools cover the common cases across the order to cash and procure to pay flows plus webhooks. When you need something rarer (accounting, tax, POS), the finder tool locates the exact path and a guarded generic request calls it.
- Token lean output. Responses strip empty fields so a large result does not flood your context. Ask for `verbose` when you want the full payload.
- One command setup. `xentral-mcp setup` wires your client, checks your token against the live instance, and backs up your existing config first.

## Payoff walk, from nothing to the first answer

1. Create a Personal Access Token in Xentral under Account settings, Developer Settings, Personal Access Tokens. Copy it once, it is shown only at creation.
2. Run the setup command and paste your instance URL and token.

   ```bash
   npx xentral-mcp setup
   ```

3. Restart your client (Claude Desktop, Claude Code, Cursor, Windsurf, or VS Code).
4. Ask a question. "List the first five products from Xentral." You have your first answer.

Confirm health any time.

```bash
npx xentral-mcp doctor
```

## Who is this for

Agencies and operators who run Xentral for DACH commerce and want an AI assistant that can read the ERP safely. The core is free and open source. The value is a grounded, correct, guard rail wrapped integration that a stranger can install in five minutes.

## Tools in this version

21 named read tools, 2 spec inventory helpers, and 1 guarded generic request. 24 in total.

| Tool | Reads | Path |
|------|-------|------|
| `xentral_list_products` | products | `GET /api/v2/products` |
| `xentral_get_product` | one product | `GET /api/v2/products/{id}` |
| `xentral_get_product_stock` | stock for one product | `GET /api/v1/products/{id}/stocks` |
| `xentral_get_product_sales_prices` | sales prices for one product | `GET /api/v1/products/{id}/salesPrices` |
| `xentral_list_customers` | customers | `GET /api/v2/customers` |
| `xentral_get_customer` | one customer | `GET /api/v2/customers/{id}` |
| `xentral_list_sales_orders` | sales orders | `GET /api/v1/salesOrders` |
| `xentral_get_sales_order` | one sales order | `GET /api/v1/salesOrders/{id}` |
| `xentral_list_invoices` | invoices | `GET /api/v1/invoices` |
| `xentral_get_invoice` | one invoice | `GET /api/v1/invoices/{id}` |
| `xentral_get_invoice_balance` | balance for one invoice | `GET /api/v1/invoices/{id}/balance` |
| `xentral_list_purchase_orders` | purchase orders | `GET /api/v1/purchaseOrders` |
| `xentral_get_purchase_order` | one purchase order | `GET /api/v1/purchaseOrders/{id}` |
| `xentral_list_delivery_notes` | delivery note documents | `GET /api/v1/deliveryNotes` |
| `xentral_get_delivery_note` | one delivery note | `GET /api/v1/deliveryNotes/{id}` |
| `xentral_get_delivery_note_shipments` | shipments for one delivery note | `GET /api/v1/deliveryNotes/{id}/shipments` |
| `xentral_list_suppliers` | suppliers | `GET /api/v1/suppliers` |
| `xentral_get_supplier` | one supplier | `GET /api/v1/suppliers/{id}` |
| `xentral_list_webhooks` | webhooks | `GET /api/v1/webhooks` |
| `xentral_get_webhook` | one webhook | `GET /api/v1/webhooks/{id}` |
| `xentral_list_webhook_event_types` | webhook event types | `GET /api/v1/webhookEventTypes` |
| `xentral_list_domains` | the API areas and their counts | bundled inventory |
| `xentral_find_endpoint` | any of 548 operations by keyword | bundled inventory |
| `xentral_request` | a guarded request against any spec present path | guarded generic |

There is no global stock list in the Xentral API, so `xentral_get_product_stock` reads stock per product and needs a product id. Sales orders, invoices, and purchase orders use the stable V1 reads. Each tool description names the newer V3 form.

### The guarded generic request

`xentral_request` reaches the operations the named tools do not cover, under a strict guard.

- GET is always allowed. POST, PATCH, and PUT are allowed only when the server starts with `XENTRAL_MCP_READONLY=false`. DELETE also needs `XENTRAL_MCP_ALLOW_DELETE=true`.
- A disallowed method returns a structured error and never calls the API.
- The path must be relative, start with `/api/`, and be present in the spec for that method. Full URLs, protocol relative forms, and path traversal are refused (SSRF guard). The Bearer token is attached automatically and never logged.
- On a 429 rate limit the request retries once after a short backoff.

Writes are off by default for a real reason. A PATCH on a sales order replaces its full line item list, so any line item left out of the body is removed. A caller must send the existing line item ids to keep them. Read stays the safe default, and a write is a deliberate choice you opt into.

## Configuration

Set these in your client config or a local `.env`.

| Variable | Meaning |
|----------|---------|
| `XENTRAL_API_URL` | Full instance host, for example `https://acme.xentral.biz`. No version segment. A bare host with no scheme gets `https` added. |
| `XENTRAL_ID` | Instance id only, expands to `https://<id>.xentral.biz`. Use one of the two. |
| `XENTRAL_TOKEN` | Personal Access Token. Never commit it. Never paste it into a chat. |
| `XENTRAL_MCP_READONLY` | Read guard. Default 1, read only. Set to `false` to allow POST, PATCH, and PUT through the generic tool. |
| `XENTRAL_MCP_ALLOW_DELETE` | Default `false`. Set to `true`, together with readonly `false`, to allow DELETE. |
| `XENTRAL_MCP_TIMEOUT_MS` | Per request timeout in milliseconds. Default 30000. |
| `XENTRAL_MAX_RESPONSE_CHARS` | Character cap for formatted output. Default 20000. |

Where your token lives. The setup command writes it into your chosen client config file on your machine, and nowhere else. The token reaches only your Xentral instance over TLS.

## Manual wiring

If your client is not in the known list, print the config block and paste it yourself.

```bash
npx xentral-mcp setup --print
```

For CI or a scripted install, drive it with flags.

```bash
npx xentral-mcp setup --yes --url https://acme.xentral.biz --token "$XENTRAL_TOKEN" --client cursor
```

## Local development

```bash
npm install
npm run typecheck
npm run build
npm run smoke
```

The smoke test starts the built server over stdio and asserts every tool registers. It makes no live Xentral call.

## Safety

- Read by default. Writes stay off unless the server starts with `XENTRAL_MCP_READONLY=false`, and DELETE also needs `XENTRAL_MCP_ALLOW_DELETE=true`.
- Method guard. A disallowed method returns a structured error and never calls the API.
- Path guard. The generic tool accepts a relative `/api/` path only, rejects a full URL, protocol relative form, and path traversal, and refuses any path that is not present in the spec for the method (SSRF guard).
- Secret hygiene. The token is never logged, and any occurrence in an error body is redacted.

## Hosted option

If you would rather not run the local stdio server, a hosted Cloudflare Worker is an alternative. It speaks the MCP Streamable HTTP transport, offers a Personal Access Token header method for direct calls, and an OAuth consent flow that signs a person in once and stores each tenant token encrypted at rest with AES-256-GCM. See `PROJECT_STRUCTURE.md` for the detail.

## Testing

The test surface is stated plainly, without inflation.

- Unit tests over the pure modules, 152 cases, 100 percent line and function coverage, run with the Node built-in test runner.
- An offline adversarial suite, 33 cases, that proves the SSRF, path, read only, and delete guards, and that hostile input never crashes the server or leaks the token.
- An MCP protocol conformance suite, 7 cases, over all 24 tools.
- A worker suite, 15 cases, over the crypto, the consent page, and the config helpers.
- A live endpoint sweep that calls every one of the 194 GET operations against a real instance and reports each one. Zero client side errors were found. A handful of accounting endpoints return a server side 500 on the demo instance because that module is not provisioned there, which the sweep records as an upstream fault, not a client fault.
- A live stress suite, 32 cases, over pagination bounds, the 100 per minute rate limit and the 429 handling, response truncation, and request timeout.

Run the offline bundle with `npm test`. It covers smoke, unit, protocol, worker, and aggression, and makes no live call. Run the live bundle with `npm run test:live`, which covers live, live write, sweep, and stress, and needs a real token and instance URL in the environment. The individual scripts `test:unit`, `test:aggression`, `test:protocol`, `test:worker`, `test:sweep`, `test:stress`, `live`, `live:write`, and `smoke` also exist.

## Project structure

See `PROJECT_STRUCTURE.md` for the folder layout, the hosted deployment, the write phase, and the cost model.

## License

MIT. See `LICENSE`.
