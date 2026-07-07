# Project structure

This document describes the folder layout, the design of Phase A (built), and the plan for Phase B and Phase C.

## Folder layout (Phase A)

```
xentral-mcp/
  src/
    index.ts          Entry point. shebang node. Dispatches setup, doctor, version, help, else runServer over stdio.
    config.ts         Pure, transport agnostic. XentralConfig type, resolveBaseUrl, buildConfig. No Node dependency.
    config-env.ts     Node only. loadConfigFromEnv and resolveBaseUrlFromEnv for the stdio path.
    worker.ts         Cloudflare Worker transport (Phase C1). Streamable HTTP MCP over the same tools, per tenant creds from headers.
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
  wrangler.jsonc              Cloudflare Worker config. Durable Object binding XENTRAL_MCP, migrations, observability.
  tsconfig.worker.json        Worker typecheck config. Workers runtime types only, isolated from the Node stdio build.
```

## Design decisions (Phase A)

- Transport agnostic core. The `http`, `config`, `errors`, `security`, `format`, and `tools` modules carry no Node builtin and no stdio assumption. The Cloudflare Worker in Phase C1 reuses them unchanged. Node env loading lives in `config-env.ts` so it never reaches the Worker runtime.
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

## Phase C1. Hosted Cloudflare Worker, PAT header method (built)

Phase C1 ships a hosted, multi tenant Worker so an agency can connect a client without a local install. It reuses the same read only tools as the stdio server, over the MCP Streamable HTTP transport.

How it works.

- `src/worker.ts` extends `McpAgent` from the `agents` SDK (version 0.17.3). The Durable Object `XentralMCP` holds one MCP session. Its `init` builds a `XentralConfig` from the per tenant props and calls `registerXentralTools`, the exact same tools the stdio server wires.
- The default fetch handler reads the tenant's Xentral host from `X-Xentral-Url` (or `X-Xentral-Id`) and the Personal Access Token from the `Authorization: Bearer` header, sets them as `ctx.props`, then delegates to `XentralMCP.serve("/mcp", { binding: "XENTRAL_MCP" })`. `McpAgent.serve` reads `ctx.props` and hands them to the session.
- A missing credential returns a 401 with a short message naming the two headers. `GET /` returns a health page with the name, version, read only note, and the two required headers.
- No credential is stored. Each request carries its own host and token, so one deployment serves many tenants.
- Verified by `wrangler deploy --dry-run`. The Worker bundles with the `XENTRAL_MCP` Durable Object binding, so no Cloudflare account is needed to prove the bundle.

## Phase C2. Front door OAuth, least friction method (planned)

Phase C2 removes the header step for the end user, so a client connects with an OAuth sign in and a one time setup rather than sending a token on every request.

Building blocks.

- `@cloudflare/workers-oauth-provider` for front door OAuth to our service, so a user authenticates to us, not to Xentral. Xentral itself offers only a Personal Access Token and no OAuth.
- Per tenant encrypted Xentral PAT storage inside the `McpAgent` Durable Object SQLite, keyed by the OAuth user. The Worker uses the stored PAT server side to call Xentral, and the user never re sends it per session.
- An MCP elicitation on first connect to capture the instance URL and the PAT once, then it is stored.

## Connection paths (the max methods matrix)

| Method | Transport | Auth to our service | Auth to Xentral | Phase |
|--------|-----------|---------------------|-----------------|-------|
| Remote plus OAuth to us | Streamable HTTP | Front door OAuth | Stored per tenant PAT | C2 |
| Remote plus PAT header | Streamable HTTP | PAT in a request header | Same PAT to Xentral | C1 |
| Local stdio | stdio | None, local process | PAT in env, this repo | A |
| mcp-remote bridge | stdio to remote | Bridged to the remote OAuth | Stored per tenant PAT | C2 |

## Monetization and operational cost

- The core is free and open source under MIT. The local stdio server in this repo costs nothing to run beyond the user's own machine.
- The hosted Phase C runs on the Cloudflare free tier for a small footprint (Workers, Durable Objects, and the OAuth provider), so operational cost stays near zero at low volume and scales cheaply.
- The buyer is a DACH Xentral agency that manages ERP for commerce clients and wants a safe, correct AI integration it can offer without building one. The paid part is the hosted multi tenant service and the setup and support, not the open core.
