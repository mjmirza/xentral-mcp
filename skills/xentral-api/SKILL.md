---
name: xentral-api
description: When building or extending the Xentral MCP, read this to ground every tool in the real spec.
---

# Xentral API Knowledge Base

This skill is the grounding source for the Xentral MCP. Before writing or editing any tool, look the operation up here so its path, method, version, and params match the real spec. Do not invent paths from memory. The Xentral API splits across two specs and three path versions, and a wrong path is costly because it feeds the build.

## What this knowledge base contains

All files live under `references/`.

- `xentral-openapi.json`. the raw main spec (Xentral API, OpenAPI 3.0.0, 339 operations), unmodified.
- `xentral-documents-openapi.json`. the raw Business Documents API v3 spec (OpenAPI 3.1.0, 209 operations), unmodified. This is where sales orders, offers, delivery notes, invoices, purchase orders, credit notes, and returns live in their V3 form.
- `llms.txt`. the raw developer-portal index, unmodified.
- `endpoint-inventory.json`. machine-readable list of every operation. each entry has `spec`, `method`, `path`, `tag`, `tags`, `summary`, `operationId`, `deprecated`, `beta`, `requiredParams`, `requestBodyRequired`.
- `endpoint-inventory.md`. the same 548 operations grouped by business domain, with per-domain counts and beta or deprecated flags.
- `auth-and-conventions.md`. auth, base URL, versioning, pagination (V1/V2 and V3), rate limits, error shapes, content-type traps, beta markers, each tied to a source.
- `notes/`. raw captures of the developer pages for auth, versioning, rate limiting, filtering and pagination, and the response envelope.
- `FLOWS-AND-GAPS.md`. the business-flow map, the corrected tool mapping, gaps and cautions, and the coverage recommendation.

## Totals at a glance

548 operations across the two specs. 194 read (GET) and 354 write (POST, PATCH, PUT, DELETE). 31 are deprecated and 109 are beta or early access. Per-domain counts are in `endpoint-inventory.md`.

## How to look up an endpoint

1. Grep `endpoint-inventory.json` or `endpoint-inventory.md` by resource word (for example `salesOrders`, `invoices`, `products`).
2. Pick the highest available version. V1 is maintenance-only and many V1 ops are deprecated where a V2 or V3 form exists.
3. Read the full operation in the matching raw spec (`xentral-openapi.json` for `/api/v1` and `/api/v2`, `xentral-documents-openapi.json` for the `/api/v3` document resources) to get the exact params, required fields, `requestBody.content` media types, and response schema.
4. Check the `deprecated` and `beta` flags in the inventory before committing to a path.

## Auth model in one paragraph

Every operation requires HTTP Bearer auth. the header is `Authorization: Bearer {token}` where the token is a Personal Access Token created in the Xentral UI (Account settings, Developer Settings, Personal Access Tokens). PATs have full permissions, no scopes, and no expiry, so the MCP must read the token from an environment variable, never log it, and never commit it. The per-instance base URL is `https://{xentralId}.xentral.biz` (or a custom domain), with the `/api/vN/...` path appended.

## Where to go next

For the flow map, the corrected paths for the planned read tools, and the coverage plan, read `FLOWS-AND-GAPS.md`. For pagination and error details, read `references/auth-and-conventions.md`.
