/**
 * Wires every Phase A tool onto the MCP server.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { registerReadTools } from "./reads.js";
import { registerDiscoverTools } from "./discover.js";
import { registerGenericTool } from "./generic.js";

/** Register the curated reads, the spec discovery tools, and the generic GET. */
export function registerXentralTools(server: McpServer, cfg: Config): void {
  registerReadTools(server, cfg);
  registerDiscoverTools(server);
  registerGenericTool(server, cfg);
}
