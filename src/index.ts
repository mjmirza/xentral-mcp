#!/usr/bin/env node
/**
 * Entry point for the Xentral MCP server.
 *
 * With no subcommand it starts the stdio MCP server. With setup, doctor,
 * version, or help it runs that command instead. All diagnostics go to stderr
 * so they never corrupt the stdio protocol on stdout.
 */

import { config as loadDotenv } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfigFromEnv } from "./config-env.js";
import { registerXentralTools } from "./tools/register.js";
import { runSetup } from "./setup/wizard.js";
import { runDoctor } from "./setup/doctor.js";

// Version is pinned here and mirrors package.json. Bump both together.
const VERSION = "0.1.0";

function printHelp(): void {
  process.stdout.write(
    [
      "xentral-mcp. Model Context Protocol server for the Xentral ERP API.",
      "",
      "Usage.",
      "  xentral-mcp                 Start the stdio MCP server (default).",
      "  xentral-mcp setup           Guided setup. wires a client and verifies the token.",
      "  xentral-mcp setup --print   Print the client config block without writing.",
      "  xentral-mcp doctor          Read only status and live token check.",
      "  xentral-mcp version         Print the version.",
      "  xentral-mcp help            Print this help.",
      "",
      "Setup flags.",
      "  --url <host>    Instance host, for example https://acme.xentral.biz.",
      "  --id <id>       Instance id, expands to https://<id>.xentral.biz.",
      "  --token <pat>   Personal Access Token.",
      "  --client <id>   Target client. claude-desktop, claude-code, cursor, windsurf, vscode.",
      "  --yes           Non interactive. use flags only, no prompts.",
      "  --no-verify     Skip the live token check.",
      "",
      "Environment.",
      "  XENTRAL_API_URL, XENTRAL_ID, XENTRAL_TOKEN, XENTRAL_MCP_READONLY,",
      "  XENTRAL_MCP_TIMEOUT_MS, XENTRAL_MAX_RESPONSE_CHARS.",
      "",
    ].join("\n"),
  );
}

/** Start the stdio MCP server. */
async function runServer(): Promise<void> {
  let cfg;
  try {
    cfg = loadConfigFromEnv(process.env);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`xentral-mcp. ${msg}\n`);
    process.exit(1);
    return;
  }

  const server = new McpServer({ name: "xentral-mcp", version: VERSION });
  registerXentralTools(server, cfg);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`xentral-mcp ${VERSION} ready. read only. host ${cfg.baseUrl}\n`);
}

async function main(): Promise<void> {
  // Load a local .env if present. Missing file is fine. Quiet so no banner
  // reaches stdout, which would corrupt the stdio JSON-RPC protocol.
  loadDotenv({ quiet: true });

  const argv = process.argv.slice(2);
  const command = argv[0];

  if (command === "setup") {
    process.exit(await runSetup(argv.slice(1)));
    return;
  }
  if (command === "doctor") {
    process.exit(await runDoctor());
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  await runServer();
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`xentral-mcp fatal. ${msg}\n`);
  process.exit(1);
});
