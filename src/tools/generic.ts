/**
 * Guarded generic API tool. This covers the long tail of endpoints (accounting,
 * analytics, tax, POS, platform, webhooks) that do not each earn a named tool.
 *
 * It defaults to a read only GET. Mutations are gated. It forces a relative
 * /api/ path via normalizePath (SSRF guard), refuses any method that is not a
 * real spec operation at that path, applies the method policy below, and always
 * attaches the Bearer header through the HTTP layer.
 *
 * Method policy.
 *   GET                 always allowed.
 *   POST, PATCH, PUT    allowed only when cfg.readonly is false.
 *   DELETE              allowed only when cfg.readonly is false AND
 *                       cfg.allowDelete is true.
 * A method that is not allowed returns an isError result and never touches the
 * network.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { xentralRequest, type QueryValue, type XentralResponse } from "../http.js";
import { XentralApiError } from "../errors.js";
import { formatResponse } from "../format.js";
import { normalizePath, normalizeMethod, isWrite } from "../security.js";
import { pathExistsForMethod } from "./discover.js";

/** Backoff in milliseconds for the single 429 retry. */
const RATE_LIMIT_RETRY_MS = 1200;

/**
 * Run one request, and on a 429 rate limit wait a short backoff and try once
 * more. The HTTP layer throws a XentralApiError with a status field on any non
 * 2xx response, so a 429 is caught here by that status. Any other error, and a
 * second 429, is rethrown to the caller.
 */
async function requestWithRateLimitRetry(
  cfg: Config,
  opts: Parameters<typeof xentralRequest>[1],
): Promise<XentralResponse> {
  try {
    return await xentralRequest(cfg, opts);
  } catch (err) {
    if (err instanceof XentralApiError && err.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
      return await xentralRequest(cfg, opts);
    }
    throw err;
  }
}

/** Decide whether the method is permitted under the current config. */
function methodAllowed(method: string, cfg: Config): { ok: true } | { ok: false; reason: string } {
  // A read method (GET, HEAD, OPTIONS) is always allowed.
  if (!isWrite(method)) return { ok: true };
  if (method === "DELETE") {
    if (cfg.readonly) {
      return {
        ok: false,
        reason:
          "Method DELETE is not permitted. The server is read only. Start it with XENTRAL_MCP_READONLY=false and XENTRAL_MCP_ALLOW_DELETE=true to allow deletes.",
      };
    }
    if (!cfg.allowDelete) {
      return {
        ok: false,
        reason:
          "Method DELETE is not permitted. Writes are enabled, but delete needs the extra opt-in XENTRAL_MCP_ALLOW_DELETE=true.",
      };
    }
    return { ok: true };
  }
  // POST, PATCH, PUT.
  if (cfg.readonly) {
    return {
      ok: false,
      reason: `Method ${method} is not permitted. The server is read only. Start it with XENTRAL_MCP_READONLY=false to allow writes.`,
    };
  }
  return { ok: true };
}

export function registerGenericTool(server: McpServer, cfg: Config): void {
  server.registerTool(
    "xentral_request",
    {
      title: "Generic API request",
      description:
        "Perform an API request against any Xentral path that is present in the spec, for example /api/v1/invoices/{id}/balance. Defaults to a read only GET. POST, PATCH, and PUT work only when the server is started with XENTRAL_MCP_READONLY=false. DELETE also needs XENTRAL_MCP_ALLOW_DELETE=true. The path must be relative and present in the spec for the chosen method. The Bearer token is attached automatically. Warning. A PATCH on a sales order replaces its full line item list, so any line item you leave out is removed. To keep the existing line items, send their ids in the body.",
      inputSchema: {
        path: z
          .string()
          .min(1)
          .describe("Relative API path starting with /api/, for example /api/v2/products or /api/v1/invoices/123/balance."),
        method: z
          .enum(["GET", "POST", "PATCH", "PUT", "DELETE"])
          .optional()
          .describe(
            "HTTP method. GET always works. POST, PATCH, PUT need XENTRAL_MCP_READONLY=false. DELETE also needs XENTRAL_MCP_ALLOW_DELETE=true. Default GET.",
          ),
        body: z
          .record(z.string(), z.unknown())
          .optional()
          .describe("JSON object sent as the request body for a non GET method. Ignored on GET."),
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
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      body?: Record<string, unknown>;
      query?: Record<string, string | number | boolean>;
      paginationMode?: "simple" | "table" | "cursor";
      verbose?: boolean;
    }) => {
      try {
        const method = normalizeMethod(args.method ?? "GET");

        const policy = methodAllowed(method, cfg);
        if (!policy.ok) {
          return {
            content: [{ type: "text" as const, text: `Error. ${policy.reason}` }],
            isError: true,
          };
        }

        const path = normalizePath(args.path);

        if (!pathExistsForMethod(path, method)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error. ${method} ${path} is not a known operation in the Xentral spec. Use xentral_find_endpoint to find valid paths and methods.`,
              },
            ],
            isError: true,
          };
        }

        const query: Record<string, QueryValue> | undefined = args.query;
        const headers = args.paginationMode ? { "X-Pagination": args.paginationMode } : undefined;
        const body = method === "GET" ? undefined : args.body;

        const res = await requestWithRateLimitRetry(cfg, { method, path, query, body, headers });
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
