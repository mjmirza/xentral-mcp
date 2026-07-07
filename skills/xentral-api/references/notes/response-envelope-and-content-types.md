# Note. Response envelope and request content types (from /reference/intro and the llms.txt endpoint descriptions)

## Success envelope

From the intro page. a response carries a `data` field plus an `extra` field. The intro states the `extra` field "contains any additional information related to the response which is not a semantic part of the representation (pagination, total count, summaries, etc.)". So list totals and pagination cursors arrive under `extra`, not inside `data`.

## Multiple request content types (a real trap)

Several write endpoints accept more than one request media type beyond `application/json`. The docs warn that the third-party doc viewer does not always show all of them, and point to the raw OpenAPI as the truth. Examples seen in llms.txt.
- Create product V1. `application/json`, `application/vnd.xentral.upsert+json`.
- Create credit note. `application/json`, `application/vnd.xentral.minimal+json`, `application/vnd.xentral.fromreturn+json`.
- Cancel sales order. `application/json`, `application/x-www-form-urlencoded`.
- Delete product. `*/*`, `application/vnd.xentral.force`.

A client that hardcodes `application/json` will miss upsert, minimal, from-return, and force behaviors. Read the per-operation `requestBody.content` in the raw spec before building any write tool.

## Destructive-update warning

Update sales order carries this caution in its description. `CAUTION: Positions not specified in the payload will be DELETED. Please pass the ids along if you need them to be preserved.` The V1 sales-order update replaces the full positions list. A partial update silently drops line items that were left out.

## Cancel vs delete

Cancel sales order description states `Only sales orders in status 'created' or 'completed' can be canceled. For draft sales orders use the delete endpoint.`
