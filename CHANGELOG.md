# Changelog

All notable changes to this project are recorded here. The format follows Keep a Changelog.

## [Unreleased]

### Added

- OAuth least friction hosted layer (Phase C2). The Worker is its own authorization server via `@cloudflare/workers-oauth-provider` (0.8.1). A person connects an MCP client to `/mcp`, signs in once on a light consent page, and enters their Xentral host and Personal Access Token. The token is verified live, encrypted with AES-256-GCM (WebCrypto, per record 12-byte IV, keyed by the `TOKEN_ENCRYPTION_KEY` secret), and stored in the OAuth grant, so the client no longer sends a token per request. `src/crypto.ts` holds the encrypt and decrypt and a non-reversible instance user id. `src/oauth/consent.ts` renders the consent page. `src/oauth/authorize.ts` runs the `/authorize` flow. The raw token is never stored and never logged. Revoke by removing the authorization in the client and deleting the token in Xentral.
- `wrangler.jsonc` gains the `OAUTH_KV` namespace binding for the OAuth token store. `src/env.d.ts` declares `OAUTH_KV`, `OAUTH_PROVIDER`, and `TOKEN_ENCRYPTION_KEY` on the Worker `Env`.

### Changed

- The header method (Phase C1) moved from `/mcp` to `/direct`. The OAuth provider matches its `apiRoute` (`/mcp`) by string prefix, so a `/mcp-direct` path would collide with the protected `/mcp` route. The header method now lives at `/direct`, which the provider passes through untouched. The stdio server and the curated tools are unchanged. `GET /` now lists both routes and the revoke steps.

### Added (earlier)

- Hosted Cloudflare Worker transport (Phase C1). `src/worker.ts` exposes the same read only tools over the MCP Streamable HTTP transport via the `agents` SDK `McpAgent` and a `XentralMCP` Durable Object. Per tenant credentials arrive as request headers (`X-Xentral-Url` or `X-Xentral-Id`, plus `Authorization: Bearer <PAT>`), a `GET /` health page shows setup help, and a missing credential returns 401. No credential is stored.
- `wrangler.jsonc` Worker config with the `XENTRAL_MCP` Durable Object binding, the v1 SQLite migration, and observability. New scripts `dev`, `deploy`, and `cf-typegen`.
- `tsconfig.worker.json` for an isolated worker typecheck under Workers runtime types, so the Node stdio build stays untouched.

### Changed

- Split `config.ts`. Previously it mixed the pure config type with Node env loading. Now `config.ts` is pure and transport agnostic (`XentralConfig`, `resolveBaseUrl`, `buildConfig`), and the Node env loading moved to `config-env.ts` (`loadConfigFromEnv`, `resolveBaseUrlFromEnv`). This lets the same tools run under both the Node stdio server and the Cloudflare Worker runtime, which has no `node:fs`, `node:readline`, or `process.env`.

## [0.1.0] 2026-07-07

Phase A. The read only foundation.

### Added

- Transport agnostic core. `config`, `errors`, `security`, `http`, and `format` modules. The `http` module is the only file that touches credentials and the network.
- Local stdio MCP server. `xentral-mcp` starts a Model Context Protocol server over stdio and registers every Phase A tool.
- Twelve curated read tools on the corrected paths from the knowledge base. products, product, product stock, customers, customer, sales orders, sales order, invoices, invoice, purchase orders, delivery notes, suppliers.
- Two spec lookup tools. `xentral_list_domains` and `xentral_find_endpoint` read the bundled inventory of 548 operations so an agent can reach any endpoint.
- One guarded generic passthrough. `xentral_request` performs a raw GET against any spec present path, refuses writes in this phase, and blocks a path that is not in the spec (SSRF guard).
- Setup wizard and doctor. `xentral-mcp setup` wires a client, verifies the token live, and backs up any existing config. `xentral-mcp doctor` runs a read only status and live token check.
- Smoke test, GitHub Actions CI, and an endpoint inventory copy that ships in the package.

### Notes

- Read only by design. No write tools in this phase.
- Sales orders, invoices, and purchase orders use the stable V1 reads. The V3 forms are noted in each tool description as the newer alternative.
