# Project structure

This document describes the folder layout, the design of Phase A (built), and the plan for Phase B and Phase C.

## Folder layout (Phase A)

```
xentral-mcp/
  src/
    index.ts          Entry point. shebang node. Dispatches setup, doctor, version, help, else runServer over stdio.
    config.ts         loadConfig(env) and resolveBaseUrl. Host from XENTRAL_API_URL or XENTRAL_ID. No version in the base.
    errors.ts         XentralApiError and redactSecrets(text, token).
    security.ts       normalizePath, normalizeMethod, isWrite. The SSRF and path guards.
    http.ts           The only file that touches credentials and the network. xentralRequest with Bearer, timeout, no redirects.
    format.ts         formatResponse. Token lean output that keeps the V3 data and extra envelope.
    data/
      endpoint-inventory.json   A copy of the 548 operation inventory. Ships in the package.
    tools/
      register.ts     registerXentralTools. Wires reads, lookup, and the generic tool.
      reads.ts        The twelve curated read tools on the corrected paths.
      discover.ts     xentral_list_domains and xentral_find_endpoint. Reads the bundled inventory.
      generic.ts      xentral_request. Guarded raw GET passthrough.
    setup/
      wizard.ts       runSetup. Prompts, live verify, atomic config write with backup, next steps.
      doctor.ts       runDoctor. Read only status and live token check.
      validate.ts     validateToken. A cheap live probe that maps status codes to clear messages.
      clients.ts      Known client config targets and safe merge helpers.
  test/
    smoke.ts          Starts the built server over stdio and asserts every tool registers.
  .github/workflows/ci.yml   Install, typecheck, build, dead code scan.
  skills/xentral-api/         The knowledge base. The source of truth for every path.
```

## Design decisions (Phase A)

- Transport agnostic core. The `http`, `config`, `errors`, `security`, and `format` modules carry no MCP or stdio assumption, so Phase C can reuse them inside a Cloudflare Worker with a different transport.
- One network file. Only `http.ts` reads the token and calls `fetch`. This keeps the credential path small and easy to audit.
- Grounded paths. Every curated tool points at a path verified against the two Xentral OpenAPI specs and the corrected mapping in `skills/xentral-api/FLOWS-AND-GAPS.md`. Sales orders, invoices, and purchase orders use the stable V1 reads. Delivery notes point at `deliveryNotes`, not the shipment level `deliveries`.
- Two pagination families. V1 and V2 use bracket keys (`page[number]`, `page[size]`). V3 uses `perPage`, `page`, `cursor`, and an `X-Pagination` header. The `http` module serializes whatever the caller passes, and `format` keeps the V3 `extra` envelope so totals and cursors survive.
- Long tail without hardcoding. The two lookup tools read the bundled inventory so an agent can find any of the 548 operations, then call it through the guarded generic GET.

## Phase B. Curated guarded writes (planned)

Phase B adds a small set of write tools around the document lifecycle, each with a guard. It stays opt in behind an explicit allow write flag.

Planned writes.

- Create sales order, then release, send, and cancel actions.
- Create invoice from a sales order or a delivery note, then send.
- Create delivery note and complete.
- Create purchase order and goods receipt.
- Create return order and credit note.

Guards for every write.

- Sales order position echo trap. An update to a sales order replaces the full positions list, so any line item left out of the payload is deleted. Every update tool will echo the existing line item ids so nothing is dropped by accident.
- Status gated cancel. Only sales orders in `created` or `completed` can be canceled. Drafts use delete. The tool will read the status first.
- Non JSON media types. Several writes accept types such as `vnd.xentral.upsert+json`, `vnd.xentral.minimal+json`, `vnd.xentral.fromreturn+json`, and `x-www-form-urlencoded`. Each write tool will set the media type the spec requires, read from the raw spec.
- Confirm and allow write gating. A write runs only when the read only guard is off and the caller confirms the action.
- Rate limit backoff. The limit is 100 requests per minute with a 429 on breach. Writes will back off on 429 and honor a Retry-After header when present.

## Phase C. Hosted Cloudflare Worker (planned)

Phase C offers a hosted, multi tenant version so an agency can connect a client without a local install. No hosted code lives in this repo yet.

Building blocks.

- `agents` SDK `McpAgent` for the agent runtime.
- `workers-oauth-provider` for the front door OAuth so a user authenticates to our service.
- Durable Objects for per tenant state and coordination.
- Streamable HTTP via `MyMCP.serve("/mcp")`.

Auth model. Xentral itself offers only a Personal Access Token, with no OAuth. So the front door OAuth authenticates the user to our service, and the user pastes their instance URL and PAT once. We store the PAT encrypted per tenant, and the Worker uses it server side to call Xentral. The user never re pastes the token per session.

Connection paths (the max methods matrix).

| Method | Transport | Auth to our service | Auth to Xentral |
|--------|-----------|---------------------|-----------------|
| Remote plus OAuth | Streamable HTTP | Front door OAuth | Stored per tenant PAT |
| Remote plus PAT header | Streamable HTTP | PAT in a request header | Same PAT to Xentral |
| Local stdio | stdio | None, local process | PAT in env, this repo |
| mcp-remote bridge | stdio to remote | Bridged to the remote OAuth | Stored per tenant PAT |

## Monetization and operational cost

- The core is free and open source under MIT. The local stdio server in this repo costs nothing to run beyond the user's own machine.
- The hosted Phase C runs on the Cloudflare free tier for a small footprint (Workers, Durable Objects, and the OAuth provider), so operational cost stays near zero at low volume and scales cheaply.
- The buyer is a DACH Xentral agency that manages ERP for commerce clients and wants a safe, correct AI integration it can offer without building one. The paid part is the hosted multi tenant service and the setup and support, not the open core.
