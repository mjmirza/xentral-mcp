# xentral-mcp

Talk to your Xentral ERP in plain language from Claude and other MCP clients. Ask for a customer, a product, an open invoice, or a sales order, and get the answer back without opening the Xentral UI or writing an API call.

![License](https://img.shields.io/github/license/mjmirza/xentral-mcp)
![Version](https://img.shields.io/github/package-json/v/mjmirza/xentral-mcp)
![Node](https://img.shields.io/badge/node-%3E%3D18.18-brightgreen)

## What you get

- Answers from your live ERP inside your AI client. "Show me the last five sales orders" returns real rows, no tab switching.
- Read only by design in this version. The server refuses every write, so an agent can look but never change your data.
- Correct paths, not guessed ones. Every tool points at a verified endpoint from the Xentral OpenAPI specs, including the traps a naive build gets wrong (delivery notes, not the shipment level `deliveries` path).
- Reach for any of 548 endpoints. Twelve named read tools cover the common cases. When you need something rarer (accounting, tax, POS), the finder tool locates the exact path and a guarded generic GET calls it.
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

## Tools in this version (read only)

| Tool | Reads | Path |
|------|-------|------|
| `xentral_list_products` | products | `GET /api/v2/products` |
| `xentral_get_product` | one product | `GET /api/v2/products/{id}` |
| `xentral_get_product_stock` | stock for one product | `GET /api/v1/products/{id}/stocks` |
| `xentral_list_customers` | customers | `GET /api/v2/customers` |
| `xentral_get_customer` | one customer | `GET /api/v2/customers/{id}` |
| `xentral_list_sales_orders` | sales orders | `GET /api/v1/salesOrders` |
| `xentral_get_sales_order` | one sales order | `GET /api/v1/salesOrders/{id}` |
| `xentral_list_invoices` | invoices | `GET /api/v1/invoices` |
| `xentral_get_invoice` | one invoice | `GET /api/v1/invoices/{id}` |
| `xentral_list_purchase_orders` | purchase orders | `GET /api/v1/purchaseOrders` |
| `xentral_list_delivery_notes` | delivery note documents | `GET /api/v1/deliveryNotes` |
| `xentral_list_suppliers` | suppliers | `GET /api/v1/suppliers` |
| `xentral_list_domains` | the API areas and their counts | bundled inventory |
| `xentral_find_endpoint` | any of 548 operations by keyword | bundled inventory |
| `xentral_request` | a raw GET against any spec present path | guarded passthrough |

There is no global stock list in the Xentral API, so `xentral_get_product_stock` reads stock per product and needs a product id. Sales orders, invoices, and purchase orders use the stable V1 reads. Each tool description names the newer V3 form.

## Configuration

Set these in your client config or a local `.env`.

| Variable | Meaning |
|----------|---------|
| `XENTRAL_API_URL` | Full instance host, for example `https://acme.xentral.biz`. No version segment. |
| `XENTRAL_ID` | Instance id only, expands to `https://<id>.xentral.biz`. Use one of the two. |
| `XENTRAL_TOKEN` | Personal Access Token. Never commit it. Never paste it into a chat. |
| `XENTRAL_MCP_READONLY` | Read only guard. Default 1. Phase A is read only regardless. |
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

- Read only. The generic tool refuses any method other than GET in this version.
- Path guard. The generic tool accepts a relative `/api/` path only, rejects a full URL, protocol relative form, and path traversal, and refuses any path that is not a GET in the spec (SSRF guard).
- Secret hygiene. The token is never logged, and any occurrence in an error body is redacted.

## Project structure

See `PROJECT_STRUCTURE.md` for the folder layout, the planned write phase, the planned hosted deployment, and the cost model.

## License

MIT. See `LICENSE`.
