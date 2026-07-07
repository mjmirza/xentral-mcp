/**
 * Path and method safety for the generic passthrough and every tool.
 *
 * The generic request tool must never be tricked into calling an arbitrary
 * host. These helpers keep the request scoped to a relative /api/ path on
 * the configured instance only (SSRF guard).
 */

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
