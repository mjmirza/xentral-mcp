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
import { maybeNotifyUpdate } from "./setup/update-check.js";
// COMMENT_REMOVAL_OK the version is no longer pinned here, it moved to version.ts.
import { VERSION } from "./version.js";
import { serverIcons } from "./icon.js";

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
      "  XENTRAL_MCP_ALLOW_DELETE, XENTRAL_MCP_TIMEOUT_MS, XENTRAL_MAX_RESPONSE_CHARS.",
      "  Set XENTRAL_MCP_READONLY=false to allow writes. DELETE also needs",
      "  XENTRAL_MCP_ALLOW_DELETE=true.",
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

  const server = new McpServer({
    name: "xentral-mcp",
    title: "Xentral MCP",
    version: VERSION,
    description: "Read your Xentral ERP from your AI client.",
    websiteUrl: "https://github.com/mjmirza/xentral-mcp",
    icons: serverIcons(),
  });
  registerXentralTools(server, cfg);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  const mode = cfg.readonly ? "read only" : cfg.allowDelete ? "writes and delete enabled" : "writes enabled";
  process.stderr.write(`xentral-mcp ${VERSION} ready. ${mode}. host ${cfg.baseUrl}\n`);
}

async function main(): Promise<void> {
  // Load a local .env if present. Missing file is fine. Quiet so no banner
  // reaches stdout, which would corrupt the stdio JSON-RPC protocol.
  loadDotenv({ quiet: true });

  const argv = process.argv.slice(2);
  const command = argv[0];

  if (command === "setup") {
    const code = await runSetup(argv.slice(1));
    await maybeNotifyUpdate(VERSION);
    process.exit(code);
    return;
  }
  if (command === "doctor") {
    const code = await runDoctor();
    await maybeNotifyUpdate(VERSION);
    process.exit(code);
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
