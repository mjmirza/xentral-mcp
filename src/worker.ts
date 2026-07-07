/**
 * Cloudflare Worker transport for the Xentral MCP server.
 *
 * Exposes the exact same read-only tools as the stdio server over the MCP
 * Streamable HTTP transport, hosted on Cloudflare. This is the Phase C1
 * method. remote plus PAT header. Each request carries the tenant's Xentral
 * host and Personal Access Token as request headers, so one deployment serves
 * many tenants without storing any credential.
 *
 * The shared core (http, security, format, errors, tools) is transport
 * agnostic and has no Node dependency, so the same registerXentralTools runs
 * here unchanged. The per tenant XentralConfig is built from the request
 * headers via the pure buildConfig, never from process env.
 *
 * Phase C2 (documented in PROJECT_STRUCTURE.md) adds front-door OAuth to our
 * service and per tenant encrypted PAT storage, which removes the header step
 * for the end user.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildConfig, resolveBaseUrl } from "./config.js";
import type { XentralConfig } from "./config.js";
import { registerXentralTools } from "./tools/register.js";

// Mirrors package.json. Bump both together.
const VERSION = "0.1.0";

/** Per tenant credentials carried on the execution context props. */
interface Props extends Record<string, unknown> {
  baseUrl: string;
  token: string;
}

/** The two request headers a client sends to reach a Xentral instance. */
const REQUIRED_HEADERS = {
  "X-Xentral-Url":
    "Your instance host, e.g. https://acme.xentral.biz. Or send X-Xentral-Id with only the instance id.",
  Authorization: "Bearer <your Xentral Personal Access Token>",
} as const;

/**
 * The Durable Object that hosts one MCP session. init builds a XentralConfig
 * from the per tenant props and registers the shared tools onto the server.
 */
export class XentralMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({ name: "xentral", version: VERSION });

  async init(): Promise<void> {
    const props = this.props;
    if (!props || !props.baseUrl || !props.token) {
      throw new Error(
        "Missing per tenant credentials. Send X-Xentral-Url (or X-Xentral-Id) and an Authorization Bearer token.",
      );
    }

    const cfg: XentralConfig = buildConfig({
      baseUrl: props.baseUrl,
      token: props.token,
      readonly: true,
    });

    registerXentralTools(this.server, cfg);
  }
}

/** Read the Xentral host and token from the request headers. */
function readTenantCreds(request: Request): Props | null {
  const auth = request.headers.get("Authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(auth.trim());
  const token = bearer ? bearer[1].trim() : "";

  const urlHeader = request.headers.get("X-Xentral-Url") ?? undefined;
  const idHeader = request.headers.get("X-Xentral-Id") ?? undefined;
  const baseUrl = resolveBaseUrl(urlHeader, idHeader);

  if (baseUrl === "" || token === "") {
    return null;
  }
  return { baseUrl, token };
}

/**
 * Front door. A human hitting GET / sees setup help. Every MCP request under
 * /mcp must carry the two credential headers, then the request is delegated to
 * the MCP agent with the per tenant props set on the execution context.
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> { // BESTPRACTICE_OK: Worker request handler, not a network fetch call.
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return Response.json({
        name: "xentral-mcp",
        version: VERSION,
        transport: "streamable-http",
        mode: "read only",
        endpoint: "/mcp",
        requiredHeaders: REQUIRED_HEADERS,
      });
    }

    const creds = readTenantCreds(request);
    if (!creds) {
      return Response.json(
        {
          error: "missing_credentials",
          message:
            "Send your Xentral host and token as request headers, then connect your MCP client to /mcp.",
          requiredHeaders: REQUIRED_HEADERS,
        },
        { status: 401 },
      );
    }

    // Hand the per tenant credentials to the MCP agent. McpAgent.serve reads
    // ctx.props and sets them on the Durable Object session.
    (ctx as ExecutionContext & { props?: Props }).props = creds;

    return XentralMCP.serve("/mcp", { binding: "XENTRAL_MCP" }).fetch(request, env, ctx); // BESTPRACTICE_OK: delegates to the MCP handler, not a network fetch call.
  },
};
