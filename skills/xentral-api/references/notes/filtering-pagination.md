# Note. Filtering, sorting, pagination (captured from the two convention pages)

## V1 and V2 (from /reference/filtering-sorting-pagination)

Filtering syntax. `filter[0][key]=fieldName&filter[0][op]=operator&filter[0][value]=value`. Range form. `filter[0][key]=keysCount&filter[0][op]=between&filter[0][from]=1&filter[0][to]=10`.

Operators (quoted list). `equals`, `notEquals`, `in`, `notIn`, `lessThan`, `lessThanOrEquals`, `greaterThan`, `greaterThanOrEquals`, `startsWith`, `endsWith`, `between`.

Ordering syntax. `order[0][field]=companyName&order[0][dir]=desc&order[1][field]=createdAt&order[1][dir]=asc`. Direction values. `ASC` or `DESC`.

Pagination syntax. `?page[number]=5&page[size]=10`. Default page size. 10. Maximum page size. 50.

Spec note. In the OpenAPI, the V2 `filter` param carries a per-resource enum of allowed keys (for products it includes `search`, `id`, `uuid`, `category`, `name`, `number`, and more), so allowed filter keys differ per endpoint.

## V3 (from /reference/v3-filterung-ordering-pagination)

Pagination header. `X-Pagination` with three values. `simple` (default, offset-based, no total), `table` (offset-based with a total via `COUNT(*)`), `cursor` (cursor-based for large data).

Pagination params. `page` (default 1), `perPage` (default 15, max varies by endpoint, the salesOrders op states max 1000), `cursor` (opaque string).

Filtering. `filter[n][key]` (supports dot notation for nested fields), `filter[n][op]`, `filter[n][value]`. Multiple filters are AND-combined.

Sorting. `sort` param, a comma-separated list of field names by priority, prefix a field with `-` for descending.

Search. `search` param for full-text-style search across predefined columns. `include` param to include related data.

Response envelope by mode.
- `simple` returns `current_page`, `per_page`, navigation links, no total.
- `table` returns `current_page`, `per_page`, `total`, `last_page`, navigation links.
- `cursor` returns `next_cursor`, `prev_cursor`.
