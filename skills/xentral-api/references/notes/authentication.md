# Note. Authentication (captured from developer.xentral.com/reference/authentication)

Token type. Personal Access Tokens (PATs).

Quote. "Personal access tokens enable API-based access to Xentral with unlimited permissions."

Token creation (quoted). "In the Xentral NextGen design, click on the Administration menu on the bottom left and then click on Account settings. Go to Developer Settings > Personal Access Tokens... Click on + Create Token... Enter a unique Name for your token."

Security note (quoted). "After you close the window you won't be able to see the token again. Make sure that you save the token in a secure space before you continue."

Facts.
- PATs have no expiration date.
- PATs carry full permissions (no scope selection in the create flow).
- Tokens should not be hardcoded or shared publicly.

Header. The auth page did not state the header format, but the OpenAPI `securitySchemes.BearerAuth` in both specs is `type: http, scheme: bearer`, so the token travels as `Authorization: Bearer {token}`. The spec description adds. "Bearer token obtained in POST /tokens endpoint or pregenerated in the system." No public `/tokens` path exists in either downloaded spec, so the practical path is a pregenerated PAT.
