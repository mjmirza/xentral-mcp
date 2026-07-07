/**
 * The one command setup wizard. Prompts for the instance host and a Personal
 * Access Token, verifies the token live, writes a safe config into the chosen
 * client, and prints the next step. Supports a print only mode and a non
 * interactive flag driven path for CI and power users.
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFileSync, writeFileSync, copyFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { resolveBaseUrl } from "../config.js";
import { validateToken } from "./validate.js";
import {
  clientTargets,
  findClient,
  buildServerEntry,
  mergeServerIntoConfig,
  type ClientTarget,
} from "./clients.js";

interface SetupFlags {
  print: boolean;
  url?: string;
  id?: string;
  token?: string;
  yes: boolean;
  client?: string;
  noVerify: boolean;
}

/** Parse setup flags from argv (after the `setup` word). */
function parseSetupFlags(argv: string[]): SetupFlags {
  const flags: SetupFlags = { print: false, yes: false, noVerify: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--print") flags.print = true;
    else if (a === "--yes" || a === "-y") flags.yes = true;
    else if (a === "--no-verify") flags.noVerify = true;
    else if (a === "--url") flags.url = argv[++i];
    else if (a === "--id") flags.id = argv[++i];
    else if (a === "--token") flags.token = argv[++i];
    else if (a === "--client") flags.client = argv[++i];
    else if (a.startsWith("--url=")) flags.url = a.slice("--url=".length);
    else if (a.startsWith("--id=")) flags.id = a.slice("--id=".length);
    else if (a.startsWith("--token=")) flags.token = a.slice("--token=".length);
    else if (a.startsWith("--client=")) flags.client = a.slice("--client=".length);
  }
  return flags;
}

function maskToken(token: string): string {
  if (token.length <= 8) return "*".repeat(token.length);
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function log(line = ""): void {
  stdout.write(`${line}\n`);
}

/** Atomic config write. Backs up an existing file to .bak, writes owner only. */
function writeConfigFile(path: string, obj: Record<string, unknown>): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (existsSync(path)) {
    copyFileSync(path, `${path}.bak`);
  }
  const serialized = `${JSON.stringify(obj, null, 2)}\n`;
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, serialized, { encoding: "utf8", mode: 0o600 });
  renameSync(tmp, path);
}

function readConfigFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    // A malformed file is backed up on write, so start from empty to avoid a crash.
    return {};
  }
}

function envFor(url: string, token: string): Record<string, string> {
  return {
    XENTRAL_API_URL: url,
    XENTRAL_TOKEN: token,
    XENTRAL_MCP_READONLY: "1",
  };
}

/** Print the copy and paste config block for manual wiring. */
function printBlock(target: ClientTarget, url: string, token: string): void {
  const entry = buildServerEntry(envFor(url, token), target.needsType);
  const block = { [target.configKey]: { xentral: entry } };
  log();
  log(`Add this to ${target.label} config (${target.configPath ?? "unknown path on this OS"}).`);
  log();
  log(JSON.stringify(block, null, 2));
  log();
}

/**
 * Run the setup wizard. Returns a process exit code.
 */
export async function runSetup(argv: string[]): Promise<number> {
  const flags = parseSetupFlags(argv);

  log("Xentral MCP setup.");
  log();

  let url = flags.url ? resolveBaseUrl(flags.url) : "";
  if (!url && flags.id) url = resolveBaseUrl(undefined, flags.id);
  let token = flags.token ?? "";

  const interactive = Boolean(stdin.isTTY) && !flags.yes;

  if (interactive && (!url || !token)) {
    const rl = createInterface({ input: stdin, output: stdout });
    try {
      if (!url) {
        log("Enter your instance URL (for example https://acme.xentral.biz) or the instance id on its own.");
        const answer = (await rl.question("Instance URL or id. ")).trim();
        if (answer.includes(".") || answer.startsWith("http")) {
          url = resolveBaseUrl(answer);
        } else {
          url = resolveBaseUrl(undefined, answer);
        }
      }
      if (!token) {
        log();
        log("Create a Personal Access Token in Xentral under Account settings, Developer Settings, Personal Access Tokens.");
        log("The token is shown once at creation and carries full permissions.");
        token = (await rl.question("Personal Access Token. ")).trim();
      }
    } finally {
      rl.close();
    }
  }

  if (!url) {
    log("No instance host was provided. Pass --url or --id, or run in an interactive terminal.");
    return 1;
  }
  if (!token) {
    log("No token was provided. Pass --token, or run in an interactive terminal.");
    return 1;
  }

  // Verify live unless asked not to.
  if (!flags.noVerify) {
    log();
    log("Verifying the token against the live instance.");
    const result = await validateToken(url, token);
    log(`  ${result.message}`);
    if (result.outcome === "unauthorized") {
      log("Setup stopped. The token was rejected. Create a fresh token and run setup again.");
      return 1;
    }
  }

  // Print only mode. Show the block and stop.
  if (flags.print) {
    const target = findClient(flags.client ?? "claude-desktop") ?? clientTargets()[0];
    printBlock(target, url, token);
    log(`Instance host. ${url}`);
    log(`Token. ${maskToken(token)} (stored only where you paste it).`);
    return 0;
  }

  // Resolve the target client.
  const target = findClient(flags.client ?? "claude-desktop");
  if (!target) {
    log(`Unknown client "${flags.client}". Known clients. ${clientTargets().map((c) => c.id).join(", ")}.`);
    return 1;
  }
  if (!target.configPath) {
    log(`No known config path for ${target.label} on this OS. Use --print to copy the block manually.`);
    printBlock(target, url, token);
    return 0;
  }

  // Merge and write.
  const existing = readConfigFile(target.configPath);
  const entry = buildServerEntry(envFor(url, token), target.needsType);
  const merged = mergeServerIntoConfig(existing, entry, target.configKey);
  writeConfigFile(target.configPath, merged);

  log();
  log(`Wired the xentral server into ${target.label}.`);
  log(`  Config file. ${target.configPath}`);
  log(`  Instance host. ${url}`);
  log(`  Token. ${maskToken(token)} stored locally in that config file, never sent anywhere else.`);
  log();
  log("Next steps.");
  log(`  1. Restart ${target.label} so it picks up the new server.`);
  log('  2. Try a prompt like. "List the first five products from Xentral."');
  log("  3. Run `npx xentral-mcp doctor` to re verify any time.");
  log();
  return 0;
}
