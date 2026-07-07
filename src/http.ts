/**
 * The only file that touches credentials and the network.
 *
 * xentralRequest builds an absolute URL from the configured host base plus a
 * relative path, attaches the Bearer token, enforces a timeout, refuses
 * redirects, and throws a redacted XentralApiError on any non 2xx response.
 *
 * Query serialization supports both pagination families. The caller passes an
 * already shaped query record. For V1 and V2 that means bracket keys like
 * "page[number]" and "filter[0][key]". For V3 that means flat keys like
 * "perPage", "page", "cursor", "sort", "search", plus an X-Pagination header
 * passed in headers. This file does not decide the family, it serializes what
 * the caller provides.
 */

import type { Config } from "./config.js";
import { XentralApiError, redactSecrets } from "./errors.js";

export type QueryValue = string | number | boolean | undefined | null;

export interface XentralRequestOptions {
  method: string;
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface XentralResponse {
  status: number;
  /** Parsed JSON when the response is JSON, otherwise the raw text. */
  data: unknown;
  /** Pagination header echoed back for V3 awareness. */
  paginationHeader?: string;
}

function buildQueryString(query: Record<string, QueryValue> | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

/**
 * Perform a single request against the Xentral instance.
 * The token is never logged and any occurrence in an error body is redacted.
 */
export async function xentralRequest(
  cfg: Config,
  opts: XentralRequestOptions,
): Promise<XentralResponse> {
  const url = `${cfg.baseUrl}${opts.path}${buildQueryString(opts.query)}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${cfg.token}`,
    Accept: "application/json",
    ...(opts.headers ?? {}),
  };

  let bodyInit: string | undefined;
  if (opts.body !== undefined && opts.body !== null) {
    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
    bodyInit = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  const requestInit: RequestInit = {
    method: opts.method,
    headers,
    body: bodyInit,
    redirect: "error",
    signal: AbortSignal.timeout(cfg.timeoutMs),
  };

  let res: Response;
  try {
    res = await fetch(url, requestInit); // BESTPRACTICE_OK: timeout applied via requestInit.signal = AbortSignal.timeout above
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    if (name === "TimeoutError" || name === "AbortError") {
      throw new XentralApiError({
        status: 0,
        path: opts.path,
        method: opts.method,
        body: `Request timed out after ${cfg.timeoutMs}ms.`,
      });
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new XentralApiError({
      status: 0,
      path: opts.path,
      method: opts.method,
      body: `Network error. ${redactSecrets(msg, cfg.token)}`,
    });
  }

  const rawText = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  const paginationHeader = res.headers.get("x-pagination") ?? undefined;

  let data: unknown = rawText;
  if (contentType.includes("json") && rawText.trim() !== "") {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  }

  if (!res.ok) {
    const bodyText = typeof data === "string" ? data : JSON.stringify(data);
    throw new XentralApiError({
      status: res.status,
      path: opts.path,
      method: opts.method,
      body: redactSecrets(bodyText.slice(0, 2000), cfg.token),
    });
  }

  return { status: res.status, data, paginationHeader };
}
