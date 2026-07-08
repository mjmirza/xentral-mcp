/**
 * Spec discovery tools. These read the bundled endpoint inventory (548
 * operations from the two Xentral OpenAPI specs) so an agent can reach any
 * endpoint, not only the curated read tools. The agent finds a path here,
 * then calls it through xentral_request.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import inventory from "../data/endpoint-inventory.json" with { type: "json" };

interface Endpoint {
  spec: string;
  method: string;
  path: string;
  tag: string;
  tags: string[];
  summary: string;
  operationId: string;
  deprecated: boolean;
  beta: boolean;
  requiredParams: string[];
  requestBodyRequired: boolean;
}

const endpoints = inventory as Endpoint[];

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/** Register the two discovery tools. */
export function registerDiscoverTools(server: McpServer): void {
  server.registerTool(
    "xentral_list_domains",
    {
      title: "List API domains",
      description:
        "Read only. List the domains (OpenAPI tags) across all 548 Xentral operations, with a per domain count of GET, POST, PATCH, PUT, DELETE. Use this to see what areas exist, then use xentral_find_endpoint to get exact paths.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      const byTag = new Map<string, Record<string, number>>();
      for (const e of endpoints) {
        const tag = e.tag || "untagged";
        const counts = byTag.get(tag) ?? {};
        counts[e.method] = (counts[e.method] ?? 0) + 1;
        counts.total = (counts.total ?? 0) + 1;
        byTag.set(tag, counts);
      }
      const rows = [...byTag.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([tag, counts]) => ({ domain: tag, total: counts.total, byMethod: counts }));
      return textResult(
        JSON.stringify({ domainCount: rows.length, operationCount: endpoints.length, domains: rows }, null, 2),
      );
    },
  );

  server.registerTool(
    "xentral_find_endpoint",
    {
      title: "Find API endpoint",
      description:
        "Search all 548 Xentral operations by keyword, and reach any endpoint the curated tools do not name. Matches against path, summary, tag, and operationId. Returns method, path, tag, summary, deprecated, and beta. Call the found path through xentral_request. GET always works. POST, PATCH, and PUT work when the server runs with XENTRAL_MCP_READONLY=false, and DELETE also needs XENTRAL_MCP_ALLOW_DELETE=true.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Keyword to match against path, summary, tag, and operationId. Case insensitive."),
        domain: z
          .string()
          .optional()
          .describe("Optional exact tag filter, for example Invoice or Sales Order. Case insensitive."),
        method: z
          .string()
          .optional()
          .describe("Optional HTTP method filter, for example GET or POST. Case insensitive."),
        includeDeprecated: z
          .boolean()
          .optional()
          .describe("When true, include deprecated operations. Default false."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Maximum results to return. Default 50."),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args: {
      query: string;
      domain?: string;
      method?: string;
      includeDeprecated?: boolean;
      limit?: number;
    }) => {
      const q = args.query.toLowerCase();
      const domain = args.domain?.toLowerCase();
      const method = args.method?.toUpperCase();
      const includeDeprecated = args.includeDeprecated ?? false;
      const limit = args.limit ?? 50;

      const matches = endpoints
        .filter((e) => {
          if (!includeDeprecated && e.deprecated) return false;
          if (method && e.method.toUpperCase() !== method) return false;
          if (domain && e.tag.toLowerCase() !== domain) return false;
          const hay = `${e.path} ${e.summary} ${e.tag} ${e.operationId}`.toLowerCase();
          return hay.includes(q);
        })
        .slice(0, limit)
        .map((e) => ({
          method: e.method,
          path: e.path,
          tag: e.tag,
          summary: e.summary,
          deprecated: e.deprecated,
          beta: e.beta,
          requiredParams: e.requiredParams,
        }));

      return textResult(
        JSON.stringify({ query: args.query, matchCount: matches.length, results: matches }, null, 2),
      );
    },
  );
}

/**
 * True when the spec inventory carries an operation for this method at a path
 * whose template matches the concrete path. Used by the guarded generic tool
 * to keep every method, not only GET, scoped to a real spec operation.
 */
export function pathExistsForMethod(path: string, method: string): boolean {
  const m = method.toUpperCase();
  return endpoints.some((e) => e.method.toUpperCase() === m && pathTemplateMatches(e.path, path));
}

/** Match a concrete request path against a spec template with {param} slots. */
function pathTemplateMatches(template: string, actual: string): boolean {
  const t = template.split("/").filter(Boolean);
  const a = actual.split("?")[0].split("/").filter(Boolean);
  if (t.length !== a.length) return false;
  for (let i = 0; i < t.length; i++) {
    const seg = t[i];
    if (seg.startsWith("{") && seg.endsWith("}")) continue;
    if (seg !== a[i]) return false;
  }
  return true;
}
