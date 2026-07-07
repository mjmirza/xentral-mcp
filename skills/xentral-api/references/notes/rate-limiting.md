# Note. Rate limiting (captured from developer.xentral.com/reference/rate-limiting)

Limit (quoted). "100 Requests / minute".

Status when exceeded (quoted). "429 - Too many requests".

Stability warning (quoted). "the final values for rate limits are currently being evaluated. The values mentioned on this page will most likely change in the future." The page is marked under construction.

Not documented on the page. burst allowance, a Retry-After header, and named rate-limit response headers. The OpenAPI spec does confirm the `429 Too Many Requests` response on write operations (seen on `POST /api/v3/salesOrders`).

Practical guidance for a client. treat 100 req/min as the working budget, back off on 429, and respect a `Retry-After` header if one is present even though the doc does not promise it.
