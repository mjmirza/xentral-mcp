/**
 * Error type and secret redaction for the Xentral MCP server.
 */

export interface XentralApiErrorInit {
  status: number;
  path: string;
  method: string;
  body?: string;
}

/** Thrown by the HTTP layer on a non 2xx response. Body is already redacted. */
export class XentralApiError extends Error {
  readonly status: number;
  readonly path: string;
  readonly method: string;
  readonly body: string;

  constructor(init: XentralApiErrorInit) {
    const summary = `Xentral API ${init.method} ${init.path} failed with ${init.status}`;
    super(init.body ? `${summary}. ${init.body}` : summary);
    this.name = "XentralApiError";
    this.status = init.status;
    this.path = init.path;
    this.method = init.method;
    this.body = init.body ?? "";
  }
}

/**
 * Remove any occurrence of the token from a string, so a leaked value never
 * reaches a log line or a tool response. Also masks common bearer patterns.
 */
export function redactSecrets(text: string, token: string): string {
  let out = text;
  if (token && token.length >= 6) {
    out = out.split(token).join("[REDACTED]");
  }
  out = out.replace(/(Bearer\s+)[A-Za-z0-9._\-]+/gi, "$1[REDACTED]");
  return out;
}
