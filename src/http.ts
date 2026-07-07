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

/** Hard ceiling on the response body read, independent of the output cap. The
 * output cap (maxResponseChars) trims the formatted text, but only after the
 * whole body is buffered. A hostile or misbehaving upstream returning a huge
 * body would exhaust memory before that trim. This bounds the read itself. */
const MAX_RESPONSE_BYTES = 25 * 1024 * 1024;

/** Read a response body up to a hard byte cap. A declared over-cap length is
 * refused before any read; otherwise the body is buffered and the byte length
 * is checked, so a chunked response that lies about its size is still bounded. */
async function readBodyCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = res.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) {
    throw new Error(`Response content-length ${declared} exceeds the ${maxBytes} byte cap and was refused.`);
  }
  const text = await res.text();
  if (text.length > maxBytes) {
    throw new Error(`Response body exceeded the ${maxBytes} byte cap and was refused.`);
  }
  return text;
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
    const hasContentType = Object.keys(headers).some((k) => k.toLowerCase() === "content-type");
    if (!hasContentType) headers["Content-Type"] = "application/json";
    bodyInit = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }

  const requestInit: RequestInit = {
    method: opts.method,
    headers,
    body: bodyInit,
    // "manual" refuses to follow a redirect (a 3xx becomes a non 2xx we reject
    // below), which keeps the SSRF guard intact. The workerd runtime rejects the
    // value "error" at fetch init, so "manual" is the portable form that works
    // under both Node and the Cloudflare Worker runtime.
    redirect: "manual",
    signal: AbortSignal.timeout(cfg.timeoutMs),
  };

  let res: Response;
  let rawText: string;
  try {
    res = await fetch(url, requestInit); // BESTPRACTICE_OK: timeout applied via requestInit.signal = AbortSignal.timeout above
    // The body read stays inside this try so a timeout or abort that fires while
    // the body is still streaming (headers arrived fast, body is slow or large)
    // is classified as a timeout and redacted, not surfaced as a raw error.
    rawText = await readBodyCapped(res, MAX_RESPONSE_BYTES);
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
    // Redact BEFORE slicing. Slicing first could cut a token in half at the
    // window boundary so the redactor never matches it. Redact an 8KB window
    // (any token sits near the start of an error body) then trim for display.
    throw new XentralApiError({
      status: res.status,
      path: opts.path,
      method: opts.method,
      body: redactSecrets(bodyText.slice(0, 8192), cfg.token).slice(0, 2000),
    });
  }

  return { status: res.status, data, paginationHeader };
}

/** Backoff in milliseconds for the single 429 retry. */
const RATE_LIMIT_RETRY_MS = 1200;

/**
 * Run one request, and on a 429 rate limit wait a short backoff and try once
 * more. The HTTP layer throws a XentralApiError with a status field on any non
 * 2xx response, so a 429 is caught here by that status. Any other error, and a
 * second 429, is rethrown to the caller. Shared by the generic passthrough and
 * every named write tool so the retry lives in one place.
 */
export async function requestWithRateLimitRetry(
  cfg: Config,
  opts: XentralRequestOptions,
): Promise<XentralResponse> {
  try {
    return await xentralRequest(cfg, opts);
  } catch (err) {
    if (err instanceof XentralApiError && err.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_MS));
      return await xentralRequest(cfg, opts);
    }
    throw err;
  }
}
