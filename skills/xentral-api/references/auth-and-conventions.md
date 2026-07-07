# Xentral API. Auth and Conventions

Sources cited. the two raw specs in this folder (`xentral-openapi.json`, `xentral-documents-openapi.json`) plus the developer pages captured under `notes/`.

## Base URL

From `servers` in both specs, the per-instance base URL has two shapes.
- `https://{xentralId}.xentral.biz` where `xentralId` is the instance id (spec default `xentral`, example `my-company`).
- `https://{domain}` for an instance on a custom domain.

The version and resource follow in the path, for example `https://acme.xentral.biz/api/v2/products`. Every operation path in the inventory already includes its `/api/vN/...` prefix.

## Authentication

Scheme. HTTP Bearer. The `components.securitySchemes.BearerAuth` in both specs is `type: http, scheme: bearer`, and top-level `security` requires it on every operation.

Header. `Authorization: Bearer {token}`.

Token. a Personal Access Token (PAT) created in the Xentral UI under Account settings, Developer Settings, Personal Access Tokens. Facts from the auth page.
- PATs carry full permissions. there is no scope picker.
- PATs have no expiration date.
- The token value is shown once at creation and cannot be retrieved later.

The spec description also mentions a token "obtained in POST /tokens endpoint or pregenerated in the system", but no public `/tokens` path exists in either downloaded spec, so a pregenerated PAT is the working path. An MCP should read the PAT from an environment variable and never log it.

## API versions

Versioning is per-endpoint and lives in the path (`/api/v1`, `/api/v2`, `/api/v3`).
- V1. maintenance mode, critical bug fixes only. Many V1 operations are marked deprecated where a V2 or V3 form exists.
- V2. the current stable form for several core resources (products, customers).
- V3. the Business Documents API (offers, sales orders, delivery notes, invoices, purchase orders, credit notes, returns) plus newer customer and supplier reads. Some V3 reads are beta.

Deprecation rule (from the versioning page). when a newer version of an endpoint ships, the previous version is automatically deprecated and removed at an unspecified later date, but a released version never gets a breaking change, so existing callers stay safe until removal. Prefer the highest available version for any given operation.

## Pagination

Two families, split by version.

V1 and V2 (offset, bracket syntax).
- `page[number]` (integer, from 1) and `page[size]` (default 10, max 50).
- `filter[n][key]`, `filter[n][op]`, `filter[n][value]`, with `filter[n][from]` and `filter[n][to]` for the `between` operator.
- Filter operators. `equals`, `notEquals`, `in`, `notIn`, `lessThan`, `lessThanOrEquals`, `greaterThan`, `greaterThanOrEquals`, `startsWith`, `endsWith`, `between`. Allowed filter keys are enumerated per resource in the spec.
- `order[n][field]` with `order[n][dir]` of `ASC` or `DESC`.

V3 (header-selected mode).
- `X-Pagination` request header picks the mode. `simple` (default, offset, no total), `table` (offset with a total from a `COUNT(*)`), `cursor` (opaque cursor for large data).
- `page` (default 1), `perPage` (default 15, max stated as 1000 on salesOrders), `cursor`.
- `filter[n][key|op|value]` with dot notation for nested fields, AND-combined.
- `sort` as a comma-separated field list, prefix `-` for descending.
- `search` for full-text-style search, `include` to pull related data.

Response envelope. success responses carry `data` plus `extra`, where `extra` holds pagination, total count, and summaries. In V3 `table` mode the envelope adds `current_page`, `per_page`, `total`, `last_page`, and links. In V3 `cursor` mode it adds `next_cursor` and `prev_cursor`. Any paging tool must read the cursor or total from `extra`, not from `data`.

## Rate limits

Stated limit. `100 Requests / minute`. Over-limit status. `429 - Too many requests`. The rate-limit page is under construction and warns the number will likely change. The spec confirms the `429 Too Many Requests` response on write operations. A client should treat 100 req/min as the budget, back off on 429, and honor a `Retry-After` header if present.

## Error responses

Common status codes seen across write operations. `400` failed validation, `401` unauthorized, `403` forbidden, `429` too many requests, and resource `404` on detail reads. The success envelope is `data` plus `extra`, and error bodies follow the same wrapped shape with validation detail. Confirm the exact error schema per operation in the raw spec, since the two specs differ (3.0.0 core versus 3.1.0 documents).

## Content-type traps (write side, but record now)

Several write endpoints accept more than `application/json`, and the hosted doc viewer hides some of them. Known extras from llms.txt. `application/vnd.xentral.upsert+json` (create product), `application/vnd.xentral.minimal+json` and `application/vnd.xentral.fromreturn+json` (create credit note), `application/x-www-form-urlencoded` (cancel sales order), `application/vnd.xentral.force` (delete product). Any write tool must read `requestBody.content` in the raw spec before choosing a media type.

## Beta and early-access markers

The spec flags 109 operations as beta or early access (see the inventory). Beta and early-access descriptions carry wording like "only available as beta version and will introduce breaking changes without further notice or versioning" (warehouses, storage locations, V3 customers, V3 suppliers) and "only available as early access version and will introduce breaking changes without further notice or versioning" (payment terms groups). Treat every beta or early-access endpoint as changeable and gate it behind a flag.
