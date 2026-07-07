/**
 * MCP protocol conformance test. Starts the built stdio server against a fake
 * host with a dummy token, connects a real MCP client, and asserts the tool
 * surface and the read only policy. Prints PASS or FAIL per case and exits non
 * zero when any case fails. No real network call and no real credential.
 *
 * The fake host resolves to a Xentral wildcard that answers 404, so a tool that
 * does reach the network fails at the transport, never at the MCP layer. That is
 * fine here. The conformance checks are about the tool contract and the policy,
 * not about live data.
 */

import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const serverEntry = join(here, "..", "dist", "index.js");

const EXPECTED_TOOL_COUNT = 37;

interface CallResult {
  isError: boolean;
  text: string;
}

/** Pull the first text block and the error flag from a tool result. */
function readResult(result: unknown): CallResult {
  const r = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  const block = (r.content ?? []).find((c) => c.type === "text");
  return { isError: r.isError === true, text: block?.text ?? "" };
}

/** True when a message reads like a schema validation error, not a real result. */
function isSchemaError(text: string): boolean {
  return /-32602|invalid arguments|input validation|validation error/i.test(text);
}

let failures = 0;

async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (err) {
    failures += 1;
    const msg = err instanceof Error ? err.message : String(err);
    process.stdout.write(`FAIL ${name}. ${msg}\n`);
  }
}

interface ToolShape {
  name: string;
  title?: string;
  description?: string;
  inputSchema: { type?: string; properties?: Record<string, unknown>; required?: string[] };
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
    env: {
      ...process.env,
      XENTRAL_API_URL: "https://protocol-test.xentral.biz",
      XENTRAL_TOKEN: "dummy-token-not-real",
      XENTRAL_MCP_READONLY: "1",
    },
  });

  const client = new Client({ name: "xentral-mcp-protocol", version: "0.1.0" });
  await client.connect(transport);

  const listed = await client.listTools();
  const tools = listed.tools as unknown as ToolShape[];

  await check("tools/list returns exactly 37 tools", () => {
    assert.equal(tools.length, EXPECTED_TOOL_COUNT, `got ${tools.length} tools`);
  });

  await check("every tool has a non-empty title, description, and object inputSchema", () => {
    for (const t of tools) {
      assert.ok(
        typeof t.title === "string" && t.title.trim().length > 0,
        `tool ${t.name} has no title`,
      );
      assert.ok(
        typeof t.description === "string" && t.description.trim().length > 0,
        `tool ${t.name} has no description`,
      );
      assert.ok(t.inputSchema && typeof t.inputSchema === "object", `tool ${t.name} has no inputSchema`);
      assert.equal(t.inputSchema.type, "object", `tool ${t.name} inputSchema is not an object schema`);
      if (t.inputSchema.properties !== undefined) {
        assert.equal(
          typeof t.inputSchema.properties,
          "object",
          `tool ${t.name} inputSchema.properties is not an object`,
        );
      }
    }
  });

  await check("tool names are unique and every name starts with xentral_", () => {
    const names = tools.map((t) => t.name);
    const unique = new Set(names);
    assert.equal(unique.size, names.length, "found duplicate tool names");
    for (const name of names) {
      assert.ok(name.startsWith("xentral_"), `tool name ${name} is not namespaced`);
    }
  });

  await check("xentral_request exposes the method enum and a path field", () => {
    const req = tools.find((t) => t.name === "xentral_request");
    assert.ok(req, "xentral_request tool is missing");
    const props = (req!.inputSchema.properties ?? {}) as Record<string, { enum?: string[] }>;
    assert.ok(props.path !== undefined, "xentral_request has no path field");
    const methodEnum = props.method?.enum ?? [];
    for (const m of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
      assert.ok(methodEnum.includes(m), `method enum is missing ${m}`);
    }
  });

  await check("read only default refuses a POST on a real inventory path", async () => {
    const res = readResult(
      await client.callTool({
        name: "xentral_request",
        arguments: { path: "/api/v2/products", method: "POST", body: {} },
      }),
    );
    assert.ok(res.isError, "expected an error result for a POST under read only mode");
    assert.match(res.text, /not permitted/i, "refusal did not mention that the method is not permitted");
    assert.match(res.text, /read only/i, "refusal did not mention the read only mode");
  });

  await check("the verbose flag is accepted without a schema error", async () => {
    const res = readResult(
      await client.callTool({
        name: "xentral_list_products",
        arguments: { pageSize: 10, verbose: true },
      }),
    );
    // The fake host makes the network leg fail, which is expected. What matters
    // is that verbose true was accepted by the schema, so any error text is a
    // transport error and never a validation error.
    assert.ok(!isSchemaError(res.text), `verbose was rejected by the schema. ${res.text.slice(0, 120)}`);
  });

  await check("a missing required argument is a graceful error and the client survives", async () => {
    let graceful = false;
    try {
      const res = readResult(await client.callTool({ name: "xentral_get_product", arguments: {} }));
      graceful = res.isError || isSchemaError(res.text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      graceful = isSchemaError(msg);
    }
    assert.ok(graceful, "a missing required argument did not produce a graceful validation error");

    const again = await client.listTools();
    assert.equal(
      again.tools.length,
      EXPECTED_TOOL_COUNT,
      "the client could not list tools after the validation error",
    );
  });

  await client.close();

  if (failures > 0) {
    process.stdout.write(`\nprotocol FAIL. ${failures} case(s) failed.\n`);
    process.exit(1);
    return;
  }
  process.stdout.write(`\nprotocol PASS. every conformance case passed.\n`);
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`protocol ERROR. ${msg}\n`);
  process.exit(1);
});
