/**
 * The /authorize endpoint for the Phase C2 OAuth flow.
 *
 * GET renders the consent page. POST reads the instance host and Personal
 * Access Token, verifies the token live against Xentral, encrypts it, and calls
 * the provider completeAuthorization with the encrypted token in the grant
 * props. The raw token never reaches the grant store and is never logged.
 *
 * The parsed OAuth request is carried from GET to POST as a base64 JSON hidden
 * field, so the form can post to a plain /authorize without the OAuth query.
 */

import type { AuthRequest } from "@cloudflare/workers-oauth-provider";
import { resolveBaseUrl } from "../config.js";
import { validateToken } from "../setup/validate.js";
import { encryptToken, userIdForInstance } from "../crypto.js";
import { renderConsentPage } from "./consent.js";

const ENC = new TextEncoder();
const DEC = new TextDecoder();
const GRANTED_SCOPE = ["xentral.read"];

function encodeAuthRequest(req: AuthRequest): string {
  const bytes = ENC.encode(JSON.stringify(req));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decodeAuthRequest(b64: string): AuthRequest {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(DEC.decode(bytes)) as AuthRequest;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET /authorize. Parse the OAuth request and render the consent page. */
export async function handleAuthorizeGet(request: Request, env: Env): Promise<Response> {
  let authReq: AuthRequest;
  try {
    authReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  } catch {
    return htmlResponse(
      renderConsentPage({
        clientName: "an application",
        oauthRequestB64: "",
        instanceValue: "",
        errorMessage: "The authorization request was not valid. Start the connection again from your client.",
      }),
      400,
    );
  }

  let clientName = "an application";
  try {
    const client = await env.OAUTH_PROVIDER.lookupClient(authReq.clientId);
    if (client && client.clientName) {
      clientName = client.clientName;
    }
  } catch {
    // A missing client name is not fatal. Fall back to the generic label.
  }

  return htmlResponse(
    renderConsentPage({
      clientName,
      oauthRequestB64: encodeAuthRequest(authReq),
      instanceValue: "",
    }),
  );
}

/** POST /authorize. Verify the token live, encrypt it, and complete the grant. */
export async function handleAuthorizePost(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const oauthReqField = String(form.get("oauth_req") ?? "");
  const instanceField = String(form.get("instance") ?? "").trim();
  const tokenField = String(form.get("token") ?? "").trim();

  let authReq: AuthRequest;
  try {
    authReq = decodeAuthRequest(oauthReqField);
  } catch {
    return htmlResponse(
      renderConsentPage({
        clientName: "an application",
        oauthRequestB64: "",
        instanceValue: instanceField,
        errorMessage: "The authorization request expired. Start the connection again from your client.",
      }),
      400,
    );
  }

  const reRender = (message: string): Response =>
    htmlResponse(
      renderConsentPage({
        clientName: "an application",
        oauthRequestB64: encodeAuthRequest(authReq),
        instanceValue: instanceField,
        errorMessage: message,
      }),
      400,
    );

  // A value with a dot or a scheme is a host. A bare word is an instance id.
  const looksLikeHost = /\./.test(instanceField) || /^https?:\/\//i.test(instanceField);
  const baseUrl = looksLikeHost
    ? resolveBaseUrl(instanceField, undefined)
    : resolveBaseUrl(undefined, instanceField);
  if (baseUrl === "") {
    return reRender("Enter your Xentral instance host, for example https://acme.xentral.biz.");
  }
  if (tokenField === "") {
    return reRender("Enter your Personal Access Token.");
  }

  const check = await validateToken(baseUrl, tokenField);
  if (check.outcome !== "valid") {
    return reRender(check.message);
  }

  const encToken = await encryptToken(tokenField, env.TOKEN_ENCRYPTION_KEY);
  const userId = await userIdForInstance(baseUrl);

  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: authReq,
    userId,
    // Metadata is not encrypted and is visible to server-side code only. It
    // carries the instance host for audit, never the token.
    metadata: { instance: baseUrl, createdAt: Date.now() },
    scope: GRANTED_SCOPE,
    // Props are encrypted by the provider into the access token and handed to
    // the MCP session as this.props. Only the encrypted token is stored here.
    props: { baseUrl, encToken },
  });

  return Response.redirect(redirectTo, 302);
}
