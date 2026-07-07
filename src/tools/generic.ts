/**
 * Guarded generic GET passthrough. This covers the long tail of read
 * endpoints (accounting, analytics, tax, POS, platform) that do not each earn
 * a named tool. It forces a relative /api/ path via normalizePath, refuses
 * any non GET method in this build, refuses a path that is not a GET in the
 * spec inventory, and always attaches the Bearer header through the HTTP layer.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { xentralRequest, type QueryValue } from "../http.js";
import { formatResponse } from "../format.js";
import { normalizePath, normalizeMethod, isWrite } from "../security.js";
import { pathExistsForGet } from "./discover.js";

export function registerGenericTool(server: McpServer, cfg: Config): void {
  server.registerTool(
    "xentral_request",
    {
      title: "Generic API request",
      description:
        "Read only in this build. Perform a raw GET against any Xentral API path found via xentral_find_endpoint, for example /api/v1/invoices/{id}/balance. The path must be relative and present as a GET in the spec. Writes are refused in this phase. The Bearer token is attached automatically.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe("Relative API path starting with /api/, for example /api/v2/products or /api/v1/invoices/123/balance."),
        method: z
          .string()
          .optional()
          .describe("HTTP method. Only GET is allowed in this build. Default GET."),
        query: z
          .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
          .optional()
          .describe(
            "Optional query parameters as a flat object. Use bracket keys for V1 and V2 (page[number], page[size], filter[0][key]). Use flat keys for V3 (perPage, page, cursor, sort, search).",
          ),
        paginationMode: z
          .enum(["simple", "table", "cursor"])
          .optional()
          .describe("V3 only. Sets the X-Pagination header. Use table to get a total count. Ignored by V1 and V2 paths."),
        verbose: z
          .boolean()
          .optional()
          .describe("When true, return the full payload. When false or absent, strip empty fields to save tokens."),
      },
    },
    async (args: {
      path: string;
      method?: string;
      query?: Record<string, string | number | boolean>;
      paginationMode?: "simple" | "table" | "cursor";
      verbose?: boolean;
    }) => {
      try {
        const method = normalizeMethod(args.method ?? "GET");
        if (isWrite(method) || method !== "GET") {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error. Method ${method} is not allowed. This build permits GET only. Write tools arrive in Phase B.`,
              },
            ],
            isError: true,
          };
        }

        const path = normalizePath(args.path);

        if (!pathExistsForGet(path)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error. Path ${path} is not a known GET operation in the Xentral spec. Use xentral_find_endpoint to discover valid paths.`,
              },
            ],
            isError: true,
          };
        }

        const query: Record<string, QueryValue> | undefined = args.query;
        const headers = args.paginationMode ? { "X-Pagination": args.paginationMode } : undefined;

        const res = await xentralRequest(cfg, { method: "GET", path, query, headers });
        const verbose = args.verbose ?? false;
        return {
          content: [
            { type: "text" as const, text: formatResponse(res.data, { verbose, maxChars: cfg.maxResponseChars }) },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text" as const, text: `Error. ${message}` }], isError: true };
      }
    },
  );
}
