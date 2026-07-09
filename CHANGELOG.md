# Changelog

All notable changes to this project are recorded here. The format follows Keep a Changelog.

## [0.1.8]

### Added

- A good-faith removal offer for rights holders. The trademark notice, the README, the OAuth consent page, and the worker health response now state that if Xentral ERP Software GmbH, or any rights holder, wants any reference to their name removed or changed, they can email support@next8n.com and it will be done promptly and in good faith. This makes the project's respect for the mark explicit and gives the owner a clear, direct channel.

## [0.1.7]

### Changed

- Trademark protection hardened. The verified owner, Xentral ERP Software GmbH (Augsburg, confirmed from their impressum), is now named in the trademark notice, the README, the OAuth consent page, and the worker health response, instead of a vague "its owner". An explicit nominative-fair-use statement and a not-legal-advice note were added to the trademark notice, and an independence and trademark disclaimer was placed on the two surfaces a person actually sees, the OAuth consent page and the worker health response.

## [0.1.6]

### Added

- A connector icon. The server advertises it in its MCP initialize response (`serverInfo.icons`, the spec mechanism), verified over the wire, and the hosted worker serves the same image at `/icon.png` and `/favicon.ico` so a client that reads the site favicon picks it up too. The icon is an original mark (a small node linked to a larger node, in the brand green), not a third-party logo, so there is no trademark question, and it is embedded as a self-contained PNG data URI so it needs no hosting and a self-hosted worker shows it as well. The serverInfo also carries a `title`, `description`, and `websiteUrl`. Whether a given client renders the icon depends on that client's support, but every server-side path is now wired. The npm README shows the mark via an absolute raster PNG URL, because npm does not render SVG. Regenerate the assets from `assets/icon.svg` with `node tools/gen-icon.mjs`.

## [0.1.4]

### Fixed

- The consent page appeared to hang on Authorize (the spinner never resolved). The real cause was our own Content-Security-Policy. `form-action 'self'` also governs the redirect that follows a form submission, and a successful authorize 302-redirects the post to the OAuth client's own callback (for example claude.ai), which is not 'self', so the browser silently blocked the whole submission before it left the page. The earlier server-side tests passed because they bypassed CSP. Fixed by allowing `form-action 'self' https:`, which permits the redirect to the client's https callback while still blocking http and other schemes.
- The token validator's messages were CLI-specific and leaked into the hosted consent page, for example "Saved the config anyway. Run xentral-mcp doctor when online", which makes no sense on a web page, plus internal "probe" wording. The messages are now context-free and the CLI wizard adds its own offline follow-up. The live check timeout dropped from 12s to 8s so a slow or wrong host fails fast with a clear message.

### Added

- A recovery watchdog on the consent page. If a submission does not resolve within 20 seconds (a proxy or firewall dropping the response, say), the button re-enables and a clear message asks the person to check their network and try again, so the spinner can never run forever.
- The hosted health endpoint now sends `Cache-Control: no-store`, so the reported version and status are always live rather than an edge-cached value.

## [0.1.3]

### Fixed

- The hosted OAuth consent page failed on submit. Two causes, both fixed. First, the parsed OAuth request was carried in the form as standard base64, whose `+` characters could turn into spaces in a form post, so the read-back threw and the page showed "the authorization request expired" in a loop. It now uses URL-safe base64url, which carries through a form field unchanged, and the reader also accepts a legacy value and re-pads defensively. Second, the POST handler had no error boundary, so a throw while reaching the instance, encrypting, completing the grant, or redirecting dropped the connection (ERR_CONNECTION_CLOSED). Every step is now guarded and returns a clear page instead of closing the connection. Validated live end to end against a cloud instance across the happy path plus bad token, unreachable host, empty fields, corrupted request, and garbage request, all handled with a visible message and no crash.

### Added

- A loading state on the consent page. On submit the Authorize button shows a spinner, changes to "Verifying your token", and blocks a double submit, so the page no longer feels dead while the token is verified. It runs under a per-response CSP nonce, and the form still works as a plain post if the script is blocked. Reduced motion is respected.

## [0.1.2]

### Added

- A gentle update notice. `xentral-mcp doctor` and `xentral-mcp setup` now check the npm registry at most once a day and, when a newer version is published, print a one line notice to stderr with the update command. The check is capped at a short timeout, cached for a day, fully silent on any error or offline, never touches the stdio serve path, and can be turned off with `XENTRAL_MCP_NO_UPDATE_CHECK=1`.
- An interactive client picker in setup. When run in a terminal without `--client`, setup now lists the known clients (Claude Desktop, Claude Code, Cursor, Windsurf, VS Code), marks the ones detected on the machine, and lets you pick, instead of silently defaulting to Claude Desktop. The `--client` flag and the non interactive path are unchanged.

### Changed

- The version is now defined once in `src/version.ts` and imported by both the stdio bin and the hosted worker, so the three previously separate hardcoded version strings can no longer drift.

## [0.1.1]

### Added

- MCP tool annotations on every tool. All 28 read tools declare `readOnlyHint: true` (with `idempotentHint: true`), and the 13 write and generic tools declare `readOnlyHint: false`. This is the standard signal a client (Claude Desktop and other MCP clients) uses to auto-approve safe reads instead of prompting for permission on every call, while still confirming writes. Verified live over the wire through the hosted worker against the cloud instance, 10 read tools green, the write guard still refusing under read only.

## [Unreleased]

### Added

- Offers and credit note reads. Four named read tools joined, list offers, one offer, list credit notes, one credit note, bringing the set to 41. Now 26 named read tools, 12 named write tools, 2 spec inventory helpers, and 1 guarded generic request.
- The security policy (`.github/SECURITY.md`) gained the residual DNS rebinding note for the multi tenant hosted path with its mitigation, the HKDF key derivation and 32 character minimum for the encryption key, and the per token grant keying.

### Changed

- Packaging trimmed to the local runtime and made platform agnostic. `agents` and `@cloudflare/workers-oauth-provider` moved from dependencies to devDependencies, so `npx xentral-mcp` installs only the MCP SDK, dotenv, and zod, with no cloud packages and no vendor lock in. The published `files` allowlist now names the local stdio subtree explicitly, so the worker, crypto, and oauth code can never ship in the npm tarball even if the build directory is polluted. The package runs locally on any OS.

### Security

- Token at rest key derivation hardened. The AES-256-GCM key is now derived from `TOKEN_ENCRYPTION_KEY` via HKDF-SHA-256 with a fixed salt and info label, instead of a bare SHA-256 digest, and a secret shorter than 32 characters is refused up front.
- Hosted OAuth grants are now keyed by the instance host and a one-way token fingerprint, so two distinct tokens on the same instance get distinct grants and no longer overwrite each other.

### Fixed

- Response truncation is now always valid JSON. An over cap payload is reduced at whole record boundaries and carries a machine readable `_truncated` marker, instead of a JSON string cut in half that a client cannot parse.
- The response body read is capped by streaming bytes with a running total and cancels the read the moment the cap is breached, so a chunked upstream that lies about its size cannot buffer past the 25 MB cap into memory.
- A path passed to the generic tool that contains a query (`?`) or fragment (`#`) is now rejected with a clear message, since query parameters belong in the structured query field, not the path.
- A 429 now honors a `Retry-After` header, seconds or HTTP date, capped at 60 seconds with jitter, instead of a fixed backoff.
- An explicit empty string query value is now sent, a valid selector for some endpoints, while undefined and null are still dropped.
- An empty JSON body now becomes null rather than an empty string, so a caller reasons about a clean absence.
- The `xentral_find_endpoint` description now states that non GET methods work when writes are enabled, instead of the stale "GET only in this build".
- The v3 pagination mode is now selectable, simple, table, or cursor, instead of hardcoded to simple.

### Added (prior steps)

- The tool set grew to 37. Twelve named write tools joined the reads, chosen by scouting the real Xentral connectors (the Make.com app, the n8n community node, the older n8n node), where the same write core keeps appearing, then cross checked against the bundled spec so every path is a real operation. Create sales order (import), release, send, and cancel a sales order, set product stock, record a shipment, create invoice, create credit note, create product, create customer, create purchase order, and receive goods on a purchase order. Every write tool is off by default. It returns a clear error and never calls the API unless the server starts with XENTRAL_MCP_READONLY=false. None use DELETE. Plus one named read, invoice documents from GET /api/v1/invoices/{id}/documents. Named write tools run on the local stdio server. The hosted worker keeps writes off, so the multi-tenant path stays read only.
- One shared write gate and one shared 429 retry. The method permission policy moved from the generic tool into security.checkWritePolicy, and the rate limit retry moved into http.requestWithRateLimitRetry, so the generic passthrough and every named write tool run through the same gate and the same retry. Offline unit tests cover the gate matrix, the write tools refusing under read only and issuing the correct method and path when enabled, and the retry path. Unit cases grew to 163 with 100 percent function coverage.
- A Nexus AI installation section in the README. A numbered offering for teams that want this set up on their own Xentral instance or extended to their exact workflow.
- The tool set had grown to 24 in the prior step. Nine more named read tools joined the twelve foundation reads. product sales prices, invoice balance, purchase order detail, delivery note detail, delivery note shipments, supplier detail, webhooks, one webhook, and webhook event types. Every path is grounded in the knowledge base, so coverage now spans the order to cash and procure to pay flows plus webhooks. 21 named reads, 2 spec inventory helpers, and 1 guarded generic request.
- A guarded generic write path. `xentral_request` moved from GET only to a guarded write, off by default. GET is always allowed. POST, PATCH, and PUT are allowed only when the server starts with `XENTRAL_MCP_READONLY=false`, and DELETE also needs `XENTRAL_MCP_ALLOW_DELETE=true`. A disallowed method returns a structured error and never calls the API. The path must be relative, start with `/api/`, and be present in the spec for that method. Full URLs, protocol relative forms, and path traversal are refused. A 429 rate limit retries once after a short backoff. Writes stay off by default because a PATCH on a sales order replaces its full line item list, so a caller must send the existing line item ids to keep them.
- A deep test suite. 152 unit cases at 100 percent line and function coverage on the Node built-in test runner, a 33 case offline adversarial suite over the SSRF, path, read only, and delete guards that proves hostile input never crashes the server or leaks the token, a 7 case protocol conformance suite over all 24 tools, a 15 case worker suite over the crypto, the consent page, and the config helpers, a live sweep over all 194 GET operations with zero client side errors, and a 32 case live stress suite over pagination bounds, the 100 per minute rate limit and 429 handling, response truncation, and request timeout. `npm test` runs the offline bundle, `npm run test:live` runs the live bundle against a real instance.
- OAuth least friction hosted layer (Phase C2). The Worker is its own authorization server via `@cloudflare/workers-oauth-provider` (0.8.1). A person connects an MCP client to `/mcp`, signs in once on a light consent page, and enters their Xentral host and Personal Access Token. The token is verified live, encrypted with AES-256-GCM (WebCrypto, per record 12-byte IV, keyed by the `TOKEN_ENCRYPTION_KEY` secret), and stored in the OAuth grant, so the client no longer sends a token per request. `src/crypto.ts` holds the encrypt and decrypt and a non-reversible instance user id. `src/oauth/consent.ts` renders the consent page. `src/oauth/authorize.ts` runs the `/authorize` flow. The raw token is never stored and never logged. Revoke by removing the authorization in the client and deleting the token in Xentral.
- `wrangler.jsonc` gains the `OAUTH_KV` namespace binding for the OAuth token store. `src/env.d.ts` declares `OAUTH_KV`, `OAUTH_PROVIDER`, and `TOKEN_ENCRYPTION_KEY` on the Worker `Env`.
- A hosted runtime integration test. `test/hosted.ts` boots the Worker in the real local Cloudflare runtime (`wrangler dev` on workerd, with local Durable Object and KV), then drives 19 cases against a real instance. the health page, the header method over MCP Streamable HTTP with real product rows, the write and SSRF guards over HTTP, the full OAuth PKCE flow (metadata, client registration, consent, authorization code, token exchange, MCP session), encryption at rest in both the KV grant store and the Durable Object store, and rejection of an unauthenticated `/mcp` request. It owns its own worker lifecycle and runs under `npm run test:hosted`.

### Changed

- The header method (Phase C1) moved from `/mcp` to `/direct`. The OAuth provider matches its `apiRoute` (`/mcp`) by string prefix, so a `/mcp-direct` path would collide with the protected `/mcp` route. The header method now lives at `/direct`, which the provider passes through untouched. The stdio server and the curated tools are unchanged. `GET /` now lists both routes and the revoke steps.

### Added (earlier)

- Hosted Cloudflare Worker transport (Phase C1). `src/worker.ts` exposes the same read only tools over the MCP Streamable HTTP transport via the `agents` SDK `McpAgent` and a `XentralMCP` Durable Object. Per tenant credentials arrive as request headers (`X-Xentral-Url` or `X-Xentral-Id`, plus `Authorization: Bearer <PAT>`), a `GET /` health page shows setup help, and a missing credential returns 401. No credential is stored.
- `wrangler.jsonc` Worker config with the `XENTRAL_MCP` Durable Object binding, the v1 SQLite migration, and observability. New scripts `dev`, `deploy`, and `cf-typegen`.
- `tsconfig.worker.json` for an isolated worker typecheck under Workers runtime types, so the Node stdio build stays untouched.

### Changed

- Split `config.ts`. Previously it mixed the pure config type with Node env loading. Now `config.ts` is pure and transport agnostic (`XentralConfig`, `resolveBaseUrl`, `buildConfig`), and the Node env loading moved to `config-env.ts` (`loadConfigFromEnv`, `resolveBaseUrlFromEnv`). This lets the same tools run under both the Node stdio server and the Cloudflare Worker runtime, which has no `node:fs`, `node:readline`, or `process.env`.

### Fixed

- The Worker outbound fetch used `redirect: "error"`, which the Cloudflare workerd runtime rejects at fetch init even though Node accepts it. This broke the whole hosted path, both connection methods and the OAuth token validation. Changed to `redirect: "manual"`, which workerd accepts, still refuses to follow a redirect, and behaves the same under Node. Found by the hosted runtime test.
- The header method left its raw token in Durable Object storage, because the Agents SDK persists a session's props. The token is now encrypted before it becomes a prop, so both the header method and the OAuth method store only AES-256-GCM ciphertext at rest. Found by the hosted runtime test.
- `formatResponse` returned a value that threw on a 204 no content body. It now returns null, found by the test suite.
- A scheme-less host string built an invalid URL. A bare host now gets `https` prepended, found by the test suite.
- Two tests had gone stale against earlier code. The http redirect test still asserted `error` after the code moved to `manual`, and the protocol conformance test hardcoded the old tool count. Both were brought in line with the current, correct behavior so the full suite is genuinely green.

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
