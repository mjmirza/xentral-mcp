/**
 * A gentle, opt-out update check for the CLI. It asks the npm registry once a
 * day for the latest published version and, if a newer one exists, prints a one
 * line notice to STDERR.
 *
 * Strict rules, so this never gets in the way.
 *  - Only ever called from the `doctor` and `setup` subcommands, never from the
 *    stdio serve path, so it cannot write to stdout and corrupt the MCP protocol.
 *  - The notice goes to stderr, not stdout.
 *  - The registry call is capped at a short timeout and every error is swallowed,
 *    so an offline machine, a slow network, or a bad response is silent.
 *  - The result is cached for a day, so a normal run makes no network call.
 *  - Set XENTRAL_MCP_NO_UPDATE_CHECK=1 to turn it off entirely.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CACHE_FILE = join(tmpdir(), "xentral-mcp-update-check.json");
const TTL_MS = 24 * 60 * 60 * 1000;
const REGISTRY_URL = "https://registry.npmjs.org/xentral-mcp/latest";
const TIMEOUT_MS = 2500;

/** True when semver-ish string a is strictly newer than b. Non-numeric or
 * missing parts are treated as 0, so a malformed value never throws. */
export function isNewer(a: string, b: string): boolean {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10));
  const pb = b.split(".").map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0;
    const y = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

/** Read the cached latest version when it is still fresh, else null. */
function readCache(): string | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as { latest?: unknown; checkedAt?: unknown };
    if (typeof parsed.latest === "string" && typeof parsed.checkedAt === "number" && Date.now() - parsed.checkedAt < TTL_MS) {
      return parsed.latest;
    }
  } catch {
    // A missing or malformed cache is fine, fall through to a live check.
  }
  return null;
}

/** Ask the registry for the latest published version, cached for a day. Returns
 * null on any failure so the caller stays silent. */
async function fetchLatest(): Promise<string | null> {
  const cached = readCache();
  if (cached !== null) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(REGISTRY_URL, { signal: controller.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const body = (await res.json()) as { version?: unknown };
    const latest = typeof body.version === "string" ? body.version : null;
    if (latest !== null) {
      try {
        writeFileSync(CACHE_FILE, JSON.stringify({ latest, checkedAt: Date.now() }), { mode: 0o600 });
      } catch {
        // A read-only temp dir is fine, the check just runs live next time.
      }
    }
    return latest;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * If a newer version is published, print a one line notice to stderr. Never
 * throws, never writes to stdout. Safe to await from a CLI subcommand only.
 */
export async function maybeNotifyUpdate(currentVersion: string): Promise<void> {
  if (process.env.XENTRAL_MCP_NO_UPDATE_CHECK === "1") return;
  try {
    const latest = await fetchLatest();
    if (latest !== null && isNewer(latest, currentVersion)) {
      process.stderr.write(
        `\nUpdate available. xentral-mcp ${latest} is out, you have ${currentVersion}.\n` +
          `  Update with. npx xentral-mcp@latest   (or, if installed globally, npm i -g xentral-mcp@latest)\n\n`,
      );
    }
  } catch {
    // Any failure here is silent by design.
  }
}
