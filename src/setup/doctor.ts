/**
 * The read only status companion. It reports the resolved host, whether a
 * token is present, verifies the token live when possible, and lists which
 * known clients already carry a xentral server entry. It never writes.
 */

import { stdout } from "node:process";
import { readFileSync, existsSync } from "node:fs";
import { resolveBaseUrlFromEnv } from "../config-env.js";
import { validateToken } from "./validate.js";
import { clientTargets } from "./clients.js";

function log(line = ""): void {
  stdout.write(`${line}\n`);
}

function maskToken(token: string): string {
  if (token === "") return "(not set)";
  if (token.length <= 8) return "*".repeat(token.length);
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function clientHasXentral(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    for (const key of ["mcpServers", "servers"]) {
      const servers = parsed[key];
      if (servers && typeof servers === "object" && "xentral" in (servers as object)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Run the doctor. Returns 0 always, since it is a read only report.
 */
export async function runDoctor(): Promise<number> {
  log("Xentral MCP doctor.");
  log();

  const url = resolveBaseUrlFromEnv(process.env);
  const token = (process.env.XENTRAL_TOKEN ?? "").trim();

  log("Environment.");
  log(`  Instance host. ${url || "(not set, set XENTRAL_API_URL or XENTRAL_ID)"}`);
  log(`  Token. ${maskToken(token)}`);
  log(`  Read only. ${process.env.XENTRAL_MCP_READONLY ?? "1"}`);
  log();

  if (url && token) {
    log("Live check.");
    const result = await validateToken(url, token);
    log(`  ${result.message}`);
    log();
  } else {
    log("Live check skipped. Set both the host and a token to verify. Run `xentral-mcp setup`.");
    log();
  }

  log("Wired clients.");
  let anyWired = false;
  for (const target of clientTargets()) {
    if (target.configPath && clientHasXentral(target.configPath)) {
      anyWired = true;
      log(`  ${target.label}. wired (${target.configPath})`);
    }
  }
  if (!anyWired) {
    log("  None found. Run `xentral-mcp setup` to wire a client.");
  }
  log();

  return 0;
}
