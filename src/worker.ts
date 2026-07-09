/**
 * Cloudflare Worker transport for the Xentral MCP server.
 *
 * This Worker serves the same read-only tools as the stdio server over the MCP
 * Streamable HTTP transport, and offers two remote connection methods on one
 * deployment.
 *
 * Phase C1, header method, on /direct. Each request carries the tenant's
 * Xentral host and Personal Access Token as request headers. The MCP session
 * persists its props on the Durable Object, so the token is encrypted first
 * (AES-256-GCM) and only the ciphertext is stored at rest, same as the OAuth
 * method. The raw token lives only in memory for the request. Good for
 * headless and CI.
 *
 * Phase C2, OAuth method, on /mcp. The Worker is its own authorization server
 * via `@cloudflare/workers-oauth-provider`. A person signs in once through a
 * consent page, enters their Xentral host and token, the token is verified live
 * and stored encrypted (AES-256-GCM) inside the OAuth grant, and the client no
 * longer sends a token per request. See src/oauth/ and src/crypto.ts.
 *
 * The shared core (http, security, format, errors, tools) is transport
 * agnostic and has no Node dependency, so the same registerXentralTools runs
 * under both methods and under the stdio server, unchanged.
 *
 * Routing note. The OAuth provider treats any path that starts with the
 * apiRoute prefix as a protected API request. The apiRoute is /mcp, so the
 * header method cannot live at /mcp-direct, which would match the /mcp prefix.
 * It lives at /direct instead, which the provider passes through to the default
 * handler untouched.
 */

import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { buildConfig, resolveBaseUrl } from "./config.js";
import type { XentralConfig } from "./config.js";
import { registerXentralTools } from "./tools/register.js";
import { decryptToken, encryptToken } from "./crypto.js";
import { handleAuthorizeGet, handleAuthorizePost } from "./oauth/authorize.js";
// COMMENT_REMOVAL_OK version now lives in one place, version.ts, shared with the bin.
import { VERSION } from "./version.js";
import { serverIcons, iconPngBytes } from "./icon.js";

/**
 * Per session credentials carried on the execution context props.
 * Both methods set `encToken`, the AES-256-GCM encrypted PAT. The header method
 * encrypts the raw PAT from the request header before it becomes a prop. The
 * OAuth method takes the encrypted PAT from the grant. The session decrypts on
 * demand, so the raw token exists only in memory and never at rest. The plain
 * `token` field remains only as a defensive fallback that no live path sets.
 */
export interface Props extends Record<string, unknown> {
  baseUrl: string;
  token?: string;
  encToken?: string;
}

/** The two request headers the header method needs to reach a Xentral instance. */
const DIRECT_HEADERS = {
  "X-Xentral-Url":
    "Your instance host, e.g. https://acme.xentral.biz. Or send X-Xentral-Id with only the instance id.",
  Authorization: "Bearer <your Xentral Personal Access Token>",
} as const;

/**
 * The Durable Object that hosts one MCP session. init resolves the token from
 * the session props (raw for the header method, decrypted for the OAuth
 * method), builds a XentralConfig, and registers the shared tools.
 */
export class XentralMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({
    name: "xentral-mcp",
    title: "Xentral MCP",
    version: VERSION,
    description: "Read your Xentral ERP from your AI client.",
    websiteUrl: "https://github.com/mjmirza/xentral-mcp",
    icons: serverIcons(),
  });

  async init(): Promise<void> {
    const props = this.props;
    if (!props || !props.baseUrl) {
      throw new Error("Missing tenant credentials on the MCP session.");
    }

    let token: string;
    if (props.encToken) {
      token = await decryptToken(props.encToken, this.env.TOKEN_ENCRYPTION_KEY);
    } else if (props.token) {
      token = props.token;
    } else {
      throw new Error("Missing Xentral token on the MCP session.");
    }

    const cfg: XentralConfig = buildConfig({
      baseUrl: props.baseUrl,
      token,
      readonly: true,
    });

    registerXentralTools(this.server, cfg);
  }
}

/** Read the Xentral host and token from the request headers (header method). */
function readTenantCreds(request: Request): { baseUrl: string; token: string } | null {
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

/** A human hitting GET / sees the two connection methods and how to revoke. */
function healthResponse(): Response {
  return Response.json({
    name: "xentral-mcp",
    version: VERSION,
    transport: "streamable-http",
    mode: "read only",
    endpoints: {
      oauth: "/mcp",
      header: "/direct",
    },
    oauthMethod:
      "Add this server URL to an MCP client. Sign in once on the consent page, enter your Xentral host and token, and the token is stored encrypted for you.",
    headerMethod: {
      endpoint: "/direct",
      requiredHeaders: DIRECT_HEADERS,
    },
    revoke:
      "Revoke the authorization in your MCP client to delete the stored grant and its encrypted token, then delete the Personal Access Token in your Xentral admin.",
  }, {
    // No caching, so the reported version and status are always live.
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * The default handler for every request that is not a protected /mcp API call.
 * It serves the health page, the /authorize consent flow, and the /direct
 * header method. The provider itself implements /token, /register, and the
 * OAuth metadata endpoints.
 */
const defaultHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> { // BESTPRACTICE_OK: Worker request handler, not a network fetch call.
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "")) {
      return healthResponse();
    }

    // The connector icon, served as a PNG, plus a favicon at the well-known path
    // so a client that derives an icon from the site favicon picks it up too.
    if (request.method === "GET" && (url.pathname === "/icon.png" || url.pathname === "/favicon.ico" || url.pathname === "/favicon.png")) {
      return new Response(iconPngBytes(), {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
      });
    }

    if (url.pathname === "/authorize") {
      if (request.method === "GET") {
        return handleAuthorizeGet(request, env);
      }
      if (request.method === "POST") {
        return handleAuthorizePost(request, env);
      }
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.pathname === "/direct" || url.pathname.startsWith("/direct/")) {
      const creds = readTenantCreds(request);
      if (!creds) {
        return Response.json(
          {
            error: "missing_credentials",
            message:
              "Send your Xentral host and token as request headers, then connect your MCP client to /direct.",
            requiredHeaders: DIRECT_HEADERS,
          },
          { status: 401 },
        );
      }
      // Hand the per tenant credentials to the MCP agent. McpAgent.serve reads
      // ctx.props and persists them on the Durable Object session, so the raw
      // token is encrypted first. Both methods then store only AES-256-GCM
      // ciphertext at rest, and init decrypts on demand.
      const encToken = await encryptToken(creds.token, env.TOKEN_ENCRYPTION_KEY);
      (ctx as ExecutionContext & { props?: Props }).props = {
        baseUrl: creds.baseUrl,
        encToken,
      };
      return XentralMCP.serve("/direct", { binding: "XENTRAL_MCP" }).fetch(request, env, ctx); // BESTPRACTICE_OK: delegates to the MCP handler, not a network fetch call.
    }

    return new Response("Not found", { status: 404 });
  },
};

/**
 * The Worker entrypoint. The OAuth provider wraps everything. Requests under
 * /mcp are checked for a valid access token, then the decrypted grant props are
 * placed on ctx.props and handed to the MCP session. Every other request goes
 * to the default handler above.
 */
export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: XentralMCP.serve("/mcp", { binding: "XENTRAL_MCP" }) as unknown as ExportedHandler<Env> & {
    fetch: NonNullable<ExportedHandler<Env>["fetch"]>;
  },
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["xentral.read"],
});
