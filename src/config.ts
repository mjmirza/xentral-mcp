/**
 * Configuration loading for the Xentral MCP server.
 *
 * Reads environment variables and produces a validated Config object.
 * Version is per path (each tool carries its own /api/vN), so baseUrl is
 * only the host, no version segment.
 */

export interface Config {
  /** Instance host base, e.g. https://acme.xentral.biz. No trailing slash, no version. */
  baseUrl: string;
  /** Personal Access Token (Bearer). Never logged. */
  token: string;
  /** Per request timeout in milliseconds. */
  timeoutMs: number;
  /** Character cap for formatted tool responses. */
  maxResponseChars: number;
  /** When true, only read (GET) requests are permitted. Default true in Phase A. */
  readonly: boolean;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_RESPONSE_CHARS = 20000;

/** Strip trailing slashes and a trailing /api segment from a base URL. */
function normalizeBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  base = base.replace(/\/api$/i, "");
  return base;
}

/** Build the host base from a Xentral instance id. */
function baseFromId(id: string): string {
  const clean = id.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "");
  return `https://${clean}.xentral.biz`;
}

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

/**
 * Resolve a base URL from either XENTRAL_API_URL (full host) or XENTRAL_ID.
 * Returns an empty string when neither is present, so callers can report a
 * clear setup message rather than throwing.
 */
export function resolveBaseUrl(env: NodeJS.ProcessEnv): string {
  if (env.XENTRAL_API_URL && env.XENTRAL_API_URL.trim() !== "") {
    return normalizeBaseUrl(env.XENTRAL_API_URL);
  }
  if (env.XENTRAL_ID && env.XENTRAL_ID.trim() !== "") {
    return baseFromId(env.XENTRAL_ID);
  }
  return "";
}

/**
 * Load config from an environment object. Throws a clear error when the
 * required host or token is missing, so the server never boots half wired.
 */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const baseUrl = resolveBaseUrl(env);
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

  return {
    baseUrl,
    token,
    timeoutMs: parseIntEnv(env.XENTRAL_MCP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    maxResponseChars: parseIntEnv(env.XENTRAL_MAX_RESPONSE_CHARS, DEFAULT_MAX_RESPONSE_CHARS),
    readonly: parseBoolEnv(env.XENTRAL_MCP_READONLY, true),
  };
}
