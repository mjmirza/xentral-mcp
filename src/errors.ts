/**
 * Error type and secret redaction for the Xentral MCP server.
 */

export interface XentralApiErrorInit {
  status: number;
  path: string;
  method: string;
  body?: string;
  /** Parsed Retry-After from a 429, in milliseconds, when the server sent one. */
  retryAfterMs?: number;
}

/** Thrown by the HTTP layer on a non 2xx response. Body is already redacted. */
export class XentralApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly method: string;
  readonly body: string;
  readonly retryAfterMs?: number;

  constructor(init: XentralApiErrorInit) {
    const summary = `Xentral API ${init.method} ${init.path} failed with ${init.status}`;
    super(init.body ? `${summary}. ${init.body}` : summary);
    this.name = "XentralApiError";
    this.status = init.status;
    this.path = init.path;
    this.method = init.method;
    this.body = init.body ?? "";
    this.retryAfterMs = init.retryAfterMs;
  }
}

/** Parse a Retry-After header value (seconds, or an HTTP date) into milliseconds.
 * Returns undefined when absent or unparseable. */
export function parseRetryAfterMs(value: string | null, nowMs: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value.trim());
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(value);
  if (Number.isFinite(when)) return Math.max(0, when - nowMs);
  return undefined;
}

/**
 * Remove any occurrence of the token from a string, so a leaked value never
 * reaches a log line or a tool response. Also masks common bearer patterns.
 */
export function redactSecrets(text: string, token: string): string {
  let out = text;
  // Redact any realistic token (4+ chars covers every real PAT while never
  // mangling a short numeric field). Also redact a url-encoded occurrence, since
  // an error body can echo the value in encoded form.
  if (token && token.length >= 4) {
    out = out.split(token).join("[REDACTED]");
    const enc = encodeURIComponent(token);
    if (enc !== token) out = out.split(enc).join("[REDACTED]");
  }
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]");
  return out;
}
