/**
 * Known MCP client config targets and safe merge helpers.
 *
 * The wizard writes a stdio server entry into a client config file without
 * clobbering any other server or key. Each target names its per OS config
 * path, the top level key that holds servers, and whether the entry needs a
 * `type: "stdio"` field.
 */

import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

export interface ClientTarget {
  id: string;
  label: string;
  /** Top level key that holds the server map. */
  configKey: string;
  /** Some clients require a type field on each server entry. */
  needsType: boolean;
  /** Absolute config path for the current OS, or null when unknown. */
  configPath: string | null;
}

export interface ServerEntry {
  command: string;
  args: string[];
  env: Record<string, string>;
  type?: string;
}

function os(): "mac" | "win" | "linux" {
  const p = platform();
  if (p === "darwin") return "mac";
  if (p === "win32") return "win";
  return "linux";
}

function appData(): string {
  return process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
}

/** Build the per OS list of known client targets. */
export function clientTargets(): ClientTarget[] {
  const home = homedir();
  const which = os();

  const claudeDesktop =
    which === "mac"
      ? join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
      : which === "win"
        ? join(appData(), "Claude", "claude_desktop_config.json")
        : join(home, ".config", "Claude", "claude_desktop_config.json");

  const cursor = join(home, ".cursor", "mcp.json");
  const windsurf = join(home, ".codeium", "windsurf", "mcp_config.json");
  const claudeCode = join(home, ".claude.json");
  const vscode =
    which === "mac"
      ? join(home, "Library", "Application Support", "Code", "User", "mcp.json")
      : which === "win"
        ? join(appData(), "Code", "User", "mcp.json")
        : join(home, ".config", "Code", "User", "mcp.json");

  return [
    { id: "claude-desktop", label: "Claude Desktop", configKey: "mcpServers", needsType: false, configPath: claudeDesktop },
    { id: "claude-code", label: "Claude Code", configKey: "mcpServers", needsType: false, configPath: claudeCode },
    { id: "cursor", label: "Cursor", configKey: "mcpServers", needsType: false, configPath: cursor },
    { id: "windsurf", label: "Windsurf", configKey: "mcpServers", needsType: false, configPath: windsurf },
    { id: "vscode", label: "VS Code", configKey: "servers", needsType: true, configPath: vscode },
  ];
}

/** Look up one target by id. */
export function findClient(id: string): ClientTarget | undefined {
  return clientTargets().find((c) => c.id === id);
}

/** True when the client's config file, or its parent app directory, exists. A
 * good hint the client is installed, used to mark it in the interactive picker. */
export function isLikelyInstalled(target: ClientTarget): boolean {
  if (!target.configPath) return false;
  try {
    return existsSync(target.configPath) || existsSync(dirname(target.configPath));
  } catch {
    return false;
  }
}

/**
 * Build the stdio server entry. The command runs the published binary via
 * npx so a client does not need a local checkout.
 */
export function buildServerEntry(env: Record<string, string>, needsType: boolean): ServerEntry {
  const entry: ServerEntry = {
    command: "npx",
    args: ["-y", "xentral-mcp"],
    env,
  };
  if (needsType) entry.type = "stdio";
  return entry;
}

/**
 * Merge a server entry into an existing config object under the given key
 * without removing any other server or top level key. Returns a new object.
 */
export function mergeServerIntoConfig(
  existing: Record<string, unknown>,
  entry: ServerEntry,
  configKey: string,
  serverName = "xentral",
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...existing };
  const servers = { ...((next[configKey] as Record<string, unknown>) ?? {}) };
  servers[serverName] = entry;
  next[configKey] = servers;
  return next;
}
