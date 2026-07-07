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
  if (!path.startsWith("/api/")) {
    throw new Error("Path must start with /api/ (for example /api/v2/products).");
  }

  return path;
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
