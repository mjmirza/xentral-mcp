/**
 * Node-only environment config loading for the stdio server.
 *
 * This is the only place that reads process-style environment variables into a
 * Config. It is imported by the stdio entry (index.ts) and the setup commands,
 * never by the worker. The worker builds its Config from request headers via
 * the pure buildConfig in config.ts.
 */

import type { Config } from "./config.js";
import {
  buildConfig,
  resolveBaseUrl,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_MAX_RESPONSE_CHARS,
} from "./config.js";

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const v = value.trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(v)) return false;
  if (["1", "true", "yes", "on"].includes(v)) return true;
  return fallback;
}

/** Resolve the instance host from XENTRAL_API_URL or XENTRAL_ID. */
export function resolveBaseUrlFromEnv(env: NodeJS.ProcessEnv): string {
  return resolveBaseUrl(env.XENTRAL_API_URL, env.XENTRAL_ID);
}

/**
 * Load config from an environment object. Throws a clear, setup-pointing error
 * when the required host or token is missing, so the server never boots half
 * wired.
 */
export function loadConfigFromEnv(env: NodeJS.ProcessEnv): Config {
  const baseUrl = resolveBaseUrlFromEnv(env);
  const token = (env.XENTRAL_TOKEN ?? "").trim();

  if (baseUrl === "") {
    throw new Error(
      "Missing instance host. Set XENTRAL_API_URL (e.g. https://acme.xentral.biz) or XENTRAL_ID. Run `xentral-mcp setup`.",
    );
  }
  if (token === "") {
    throw new Error(
      "Missing token. Set XENTRAL_TOKEN to a Personal Access Token. Run `xentral-mcp setup`.",
    );
  }

  return buildConfig({
    baseUrl,
    token,
    timeoutMs: parseIntEnv(env.XENTRAL_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxResponseChars: parseIntEnv(env.XENTRAL_MAX_RESPONSE_CHARS, DEFAULT_MAX_RESPONSE_CHARS),
    readonly: parseBoolEnv(env.XENTRAL_MCP_READONLY, true),
    allowDelete: parseBoolEnv(env.XENTRAL_MCP_ALLOW_DELETE, false),
    allowInsecureHttp: parseBoolEnv(env.XENTRAL_ALLOW_INSECURE_HTTP, false),
    allowPrivateHost: parseBoolEnv(env.XENTRAL_ALLOW_PRIVATE_HOST, false),
  });
}
