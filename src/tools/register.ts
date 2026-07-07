/**
 * Wires every Phase A tool onto the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { registerReadTools } from "./reads.js";
import { registerWriteTools } from "./writes.js";
import { registerDiscoverTools } from "./discover.js";
import { registerGenericTool } from "./generic.js";

/**
 * Register the curated reads, the named write tools (off unless write enabled),
 * the spec discovery tools, and the guarded generic request.
 */
export function registerXentralTools(server: McpServer, cfg: Config): void {
  registerReadTools(server, cfg);
  registerWriteTools(server, cfg);
  registerDiscoverTools(server);
  registerGenericTool(server, cfg);
}
