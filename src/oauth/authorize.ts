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

/** Encode the parsed OAuth request as URL-safe base64url (no +, /, or = ), so it
 * carries through a form field without any + turning into a space and breaking
 * the round trip. That corruption was the cause of the "request expired" error.
 * Exported for a round-trip test. */
export function encodeAuthRequest(req: AuthRequest): string {
  const bytes = ENC.encode(JSON.stringify(req));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Read back a carried OAuth request. Accepts base64url (what we now emit) and
 * legacy standard base64, and re-pads, so an old in-flight value still works.
 * Throws only when the value is genuinely not an auth request. Exported for a
 * round-trip test. */
export function decodeAuthRequest(value: string): AuthRequest {
  let s = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad > 0) s += "=".repeat(4 - pad);
  const binary = atob(s);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const obj = JSON.parse(DEC.decode(bytes)) as unknown;
  if (!obj || typeof obj !== "object" || typeof (obj as { clientId?: unknown }).clientId !== "string") {
    throw new Error("The value is not a valid authorization request.");
  }
  return obj as AuthRequest;
}

/** A short random nonce so the one small loading script may run under the CSP. */
function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function htmlResponse(body: string, status = 200, nonce = ""): Response {
  const scriptSrc = nonce ? ` script-src 'nonce-${nonce}';` : "";
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Page hardening for the consent and authorize surface. Inline style only,
      // plus one nonce'd loading script, no framing.
      //
      // form-action must allow https, not only 'self'. The browser applies
      // form-action to the whole submission chain including redirects, and a
      // successful authorize 302-redirects the form post to the OAuth client's
      // own https callback (for example claude.ai). Restricting it to 'self'
      // silently blocks the submission in the browser, which is why the page
      // appeared to hang. Allowing https keeps http and other schemes blocked.
      "Content-Security-Policy":
        `default-src 'none'; style-src 'unsafe-inline'; img-src 'self';${scriptSrc} form-action 'self' https:; frame-ancestors 'none'; base-uri 'none'`,
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    },
  });
}

/** A last-resort error page, so an unexpected throw is a clear message the
 * person can act on, never a closed connection. */
function fatalPage(nonce: string): Response {
  return htmlResponse(
    renderConsentPage({
      clientName: "an application",
      oauthRequestB64: "",
      instanceValue: "",
      errorMessage: "Something went wrong on our side. Please start the connection again from your client, and try once more.",
      nonce,
    }),
    500,
    nonce,
  );
}

/** GET /authorize. Parse the OAuth request and render the consent page. */
export async function handleAuthorizeGet(request: Request, env: Env): Promise<Response> {
  const nonce = makeNonce();
  try {
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
          nonce,
        }),
        400,
        nonce,
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
        nonce,
      }),
      200,
      nonce,
    );
  } catch {
    return fatalPage(nonce);
  }
}

/** POST /authorize. Verify the token live, encrypt it, and complete the grant.
 * Every branch returns a response. an unexpected throw is caught and shown as a
 * clear page, so the connection is never dropped. */
export async function handleAuthorizePost(request: Request, env: Env): Promise<Response> {
  const nonce = makeNonce();
  try {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return htmlResponse(
        renderConsentPage({
          clientName: "an application",
          oauthRequestB64: "",
          instanceValue: "",
          errorMessage: "The form could not be read. Start the connection again from your client.",
          nonce,
        }),
        400,
        nonce,
      );
    }
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
          errorMessage: "The authorization request could not be read. Start the connection again from your client.",
          nonce,
        }),
        400,
        nonce,
      );
    }

    const reRender = (message: string): Response =>
      htmlResponse(
        renderConsentPage({
          clientName: "an application",
          oauthRequestB64: encodeAuthRequest(authReq),
          instanceValue: instanceField,
          errorMessage: message,
          nonce,
        }),
        400,
        nonce,
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

    // The live token check reaches the person's instance, so a network failure
    // or a bad host must become a clear message, never an unhandled throw.
    let check;
    try {
      check = await validateToken(baseUrl, tokenField);
    } catch {
      return reRender("Could not reach that Xentral instance. Check the host is correct and reachable, then try again.");
    }
    if (check.outcome !== "valid") {
      return reRender(check.message);
    }

    const encToken = await encryptToken(tokenField, env.TOKEN_ENCRYPTION_KEY);
    const userId = await userIdForInstance(baseUrl, tokenField);

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

    // A malformed redirect target must not throw and drop the connection.
    try {
      return Response.redirect(redirectTo, 302);
    } catch {
      return reRender("The connection was authorized, but the client sent an invalid return address. Start the connection again from your client.");
    }
  } catch {
    return fatalPage(nonce);
  }
}
