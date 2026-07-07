/**
 * Path and method safety for the generic passthrough and every tool.
 *
 * The generic request tool must never be tricked into calling an arbitrary
 * host. These helpers keep the request scoped to a relative /api/ path on
 * the configured instance only (SSRF guard).
 */

import type { Config } from "./config.js";

/** True when the string contains any ASCII control character or DEL. */
function hasControlChars(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize and validate a request path. Rejects a full URL, protocol
 * relative form, path traversal, and control characters. Returns a relative
 * path that starts with /api/.
 */
export function normalizePath(input: string): string {
  const raw = (input ?? "").trim();

  if (raw === "") {
    throw new Error("Path is empty. Provide a relative path like /api/v2/products.");
  }
  if (/^[a-z][a-z0-9+.\-]*:\/\//i.test(raw)) {
    throw new Error("Path must be relative. A full URL is not allowed.");
  }
  if (raw.startsWith("//")) {
    throw new Error("Path must not start with // (protocol relative form is not allowed).");
  }
  if (hasControlChars(raw)) {
    throw new Error("Path contains control characters.");
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;

  if (path.includes("..")) {
    throw new Error("Path traversal (..) is not allowed.");
  }
  // Encoded traversal and separator smuggling. A percent-encoded dot (%2e),
  // slash (%2f), or a backslash can rebuild a traversal or escape the /api/
  // prefix after the server decodes it. Refuse them up front (defense in depth,
  // on top of the spec-existence check the generic tool also applies).
  if (/%2e|%2f|%5c/i.test(path) || path.includes("\\")) {
    throw new Error("Path contains an encoded traversal or separator (%2e, %2f, %5c, or a backslash).");
  }
  if (!path.startsWith("/api/")) {
    throw new Error("Path must start with /api/ (for example /api/v2/products).");
  }

  return path;
}

/** Policy for which instance hosts are permitted. Both default off, so the
 * safe posture (https only, public host only) applies unless an operator opts
 * in for a genuine local or internal instance. */
export interface HostPolicy {
  allowInsecureHttp?: boolean;
  allowPrivateHost?: boolean;
}

/** True when the host is a loopback, private, link-local, or bare IP literal.
 * A real Xentral instance is always a public domain, never an IP literal, so
 * every IP literal is blocked by default. This is the SSRF egress guard for the
 * tenant-supplied base URL on the hosted worker, and for a mis-set stdio host. */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 literal. Any colon-bearing host is an IPv6 address literal.
  if (h.includes(":")) return true;
  // IPv4 literal. Four dotted decimal octets.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  return false;
}

/**
 * Assert that a normalized base URL is safe to send a credential to. Rejects a
 * userinfo host-spoof (user:pass@host), a cleartext http host (a PAT must not
 * travel unencrypted), and a private, loopback, link-local, or IP-literal host
 * (SSRF, an authenticated open proxy from the worker egress). Each block has an
 * explicit opt-in for a genuine local or internal deployment.
 */
export function assertSafeBaseUrl(baseUrl: string, policy: HostPolicy = {}): void {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Instance host is not a valid URL.");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("Instance host must not contain userinfo. A user:pass@host form is refused (host-spoof guard).");
  }
  if (url.protocol !== "https:") {
    if (!(policy.allowInsecureHttp && url.protocol === "http:")) {
      throw new Error(
        "Instance host must use https so the token is not sent in cleartext. Set XENTRAL_ALLOW_INSECURE_HTTP=1 for a local instance only.",
      );
    }
  }
  if (!policy.allowPrivateHost && isBlockedHost(url.hostname)) {
    throw new Error(
      `Instance host ${url.hostname} is a loopback, private, link-local, or IP-literal address and is refused (SSRF guard). Set XENTRAL_ALLOW_PRIVATE_HOST=1 for a trusted internal instance.`,
    );
  }
}

/** Uppercase and validate an HTTP method. */
export function normalizeMethod(input: string): string {
  const method = (input ?? "GET").trim().toUpperCase();
  const allowed = ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"];
  if (!allowed.includes(method)) {
    throw new Error(`Unsupported method ${method}.`);
  }
  return method;
}

/** True when the method mutates state. */
export function isWrite(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(normalizeMethod(method));
}

/** Result of a write permission check. Internal, used as the return shape of
 * checkWritePolicy. Callers read ok and reason structurally. */
interface WritePolicyResult {
  ok: boolean;
  reason?: string;
}

/**
 * The single source of truth for whether a method is permitted under the
 * current config. Every tool that can mutate state, the generic passthrough
 * and each named write tool, runs its method through this one gate.
 *
 * Policy.
 *   GET, HEAD, OPTIONS    always allowed.
 *   POST, PATCH, PUT      allowed only when cfg.readonly is false.
 *   DELETE                allowed only when cfg.readonly is false AND
 *                         cfg.allowDelete is true.
 */
export function checkWritePolicy(method: string, cfg: Config): WritePolicyResult {
  const m = normalizeMethod(method);
  if (!isWrite(m)) return { ok: true };
  if (m === "DELETE") {
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
      reason: `Method ${m} is not permitted. The server is read only. Start it with XENTRAL_MCP_READONLY=false to allow writes.`,
    };
  }
  return { ok: true };
}
