/**
 * Pure, transport-agnostic configuration for the Xentral MCP tools.
 *
 * This module has no dependency on any runtime builtin. It carries the
 * config type, the base URL helpers, and a pure config builder, so the same
 * shape works under Node (stdio) and under the Cloudflare Worker runtime.
 * The Node env loading and env-string parsing (formerly loadConfig,
 * parseIntEnv, parseBoolEnv) moved to config-env.ts. CODE_DELETE_OK: moved
 * node env helpers to config-env.ts to keep this core worker-safe.
 *
 * Version is per path (each tool carries its own /api/vN), so baseUrl is
 * only the host, no version segment.
 */

import { assertSafeBaseUrl } from "./security.js";

export interface Config {
  /** Instance host base, e.g. https://acme.xentral.biz. No trailing slash, no version. */
  baseUrl: string;
  /** Personal Access Token (Bearer). Never logged. */
  token: string;
  /** Per request timeout in milliseconds. */
  timeoutMs: number;
  /** Character cap for formatted tool responses. */
  maxResponseChars: number;
  /** When true, only read (GET) requests are permitted. Default true. */
  readonly: boolean;
  /**
   * When true, DELETE requests are permitted. Only takes effect when readonly
   * is false. This is a second, explicit opt-in so a write-enabled server still
   * refuses deletes unless the operator asked for them. Default false.
   */
  allowDelete: boolean;
}

/**
 * Alias used by the worker layer. The tools take a Config, the worker builds
 * one per tenant, so both names point at the same pure shape.
 */
export type XentralConfig = Config;

export const DEFAULT_TIMEOUT_MS = 30000;
export const DEFAULT_MAX_RESPONSE_CHARS = 20000;

/** Strip trailing slashes and a trailing /api segment from a base URL, and add
 * an https scheme when the caller passed a bare host with none. A scheme-less
 * host would otherwise build an invalid request URL. */
export function normalizeBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  base = base.replace(/\/api$/i, "");
  if (base !== "" && !/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base;
}

/** Build the host base from a Xentral instance id. */
export function baseFromId(id: string): string {
  const clean = id.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return `https://${clean}.xentral.biz`;
}

/**
 * Resolve a base URL from either a full host URL or a bare instance id.
 * Pure. Returns an empty string when neither is present, so callers can report
 * a clear setup message rather than throwing.
 */
export function resolveBaseUrl(apiUrl?: string, id?: string): string {
  if (apiUrl && apiUrl.trim() !== "") {
    return normalizeBaseUrl(apiUrl);
  }
  if (id && id.trim() !== "") {
    return baseFromId(id);
  }
  return "";
}

/** Input to buildConfig. Only baseUrl and token are required. */
export interface BuildConfigInput {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  maxResponseChars?: number;
  readonly?: boolean;
  allowDelete?: boolean;
  /** Allow an http (cleartext) host. Off by default, for a local instance only. */
  allowInsecureHttp?: boolean;
  /** Allow a private, loopback, or IP-literal host. Off by default, for a
   * trusted internal instance only. */
  allowPrivateHost?: boolean;
}

/**
 * Pure config builder. Validates that a host and token are present, normalizes
 * the host, and applies defaults. Any caller (Node env loader, worker header
 * reader) builds a Config through this one path.
 */
export function buildConfig(input: BuildConfigInput): Config {
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? "");
  const token = (input.token ?? "").trim();

  if (baseUrl === "") {
    throw new Error(
      "Missing instance host. Provide a host like https://acme.xentral.biz or an instance id.",
    );
  }
  if (token === "") {
    throw new Error("Missing token. Provide a Personal Access Token.");
  }

  // Host safety, the SSRF and cleartext-credential guard. Applied to every
  // Config, stdio and worker, so a tenant-supplied or mis-set host can never
  // point the Bearer token at an internal, loopback, or http destination.
  assertSafeBaseUrl(baseUrl, {
    allowInsecureHttp: input.allowInsecureHttp,
    allowPrivateHost: input.allowPrivateHost,
  });

  const timeoutMs =
    input.timeoutMs && input.timeoutMs > 0 ? input.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxResponseChars =
    input.maxResponseChars && input.maxResponseChars > 0
      ? input.maxResponseChars
      : DEFAULT_MAX_RESPONSE_CHARS;

  return {
    baseUrl,
    token,
    timeoutMs,
    maxResponseChars,
    readonly: input.readonly ?? true,
    allowDelete: input.allowDelete ?? false,
  };
}
