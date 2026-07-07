# Changelog

All notable changes to this project are recorded here. The format follows Keep a Changelog.

## [Unreleased]

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
