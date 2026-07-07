# Note. Versioning (captured from developer.xentral.com/reference/versioning and /reference/rest-api)

Version in path. Versions sit in the request path, `/api/v1/...`, `/api/v2/...`, `/api/v3/...`. Each endpoint carries its own version rather than the whole API sharing one.

V1 status (quoted from /reference/rest-api). "The V1 REST API is currently only in maintenance mode." V1 receives only critical bug fixes going forward.

Breaking-change policy (quoted). "Whenever breaking changes are implemented this will be done in a new version of the endpoint." Breaking changes include modifying payload structure, removing payload elements, and significant data-processing changes. Adding payload items is not considered breaking.

Deprecation (quoted). "When a new version of an endpoint is released the previous version automatically gets deprecated and will be removed at a later point in time." Also. "Users can safely use previous versions and will not face any issues, as we will not introduce a breaking change into a version that is already released." Removal timeline is unspecified.

Legacy note. Earlier header-based versioning via accept and content-type headers is deprecated. All new endpoints use path-based versioning.

Consequence for a client. an operation that has a V2 or V3 form should prefer that form. The V1 form still works but is deprecated once a newer version ships.
