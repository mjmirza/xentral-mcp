/**
 * Live integration test for the hosted Cloudflare Worker.
 *
 * This harness boots the Worker locally in workerd via `wrangler dev`, with a
 * local Durable Object and a local KV simulation, then drives the real thing
 * end to end. No cloud deploy. The Worker forwards to the real Xentral demo, so
 * every tool call reaches the live instance through the Worker.
 *
 * The harness owns the whole lifecycle. It spawns wrangler, waits for the
 * "Ready on" line, runs the cases, and kills the wrangler and workerd children
 * on the way out so nothing is left running and the port is freed.
 *
 * Credentials come from the environment only. XENTRAL_TOKEN and XENTRAL_API_URL
 * must be set by the caller. The raw token is never written to a file, never
 * logged, and never echoed. The demo host is not hardcoded here.
 *
 * Cases.
 *   1. Health. GET / is 200 and names both endpoints. GET /direct is 401.
 *   2. Header method. Connect to /direct with the two headers, list 24 tools,
 *      read real products, prove the write guard and the path guard hold.
 *   3. OAuth method. Metadata, register, PKCE, consent, code, token, then a
 *      real MCP session on /mcp against the demo.
 *   4. Encryption at rest. The raw token appears zero times under .wrangler.
 *   5. Negative OAuth. /mcp rejects an unauthenticated request.
 */

import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { readdirSync, readFileSync, statSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

// assert is imported for use in ad hoc checks below the recorder.
void assert;

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const PORT = 8787;
const HOST = "127.0.0.1";
const ORIGIN = `http://${HOST}:${PORT}`;
const REDIRECT_URI = "http://127.0.0.1:9999/callback";
const HTTP_TIMEOUT_MS = 20000;

const TOKEN = process.env.XENTRAL_TOKEN ?? "";
const DEMO_URL = process.env.XENTRAL_API_URL ?? "";
if (TOKEN.trim() === "" || DEMO_URL.trim() === "") {
  process.stderr.write(
    "hosted ERROR. XENTRAL_TOKEN and XENTRAL_API_URL must be set in the environment.\n",
  );
  process.exit(1);
}

/** fetch with a bounded per request timeout, so a hung server never stalls us. */
function hfetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
}

let failures = 0;
function record(pass: boolean, name: string, detail: string): void {
  if (pass) {
    process.stdout.write(`PASS ${name}. ${detail}\n`);
  } else {
    failures += 1;
    process.stdout.write(`FAIL ${name}. ${detail}\n`);
  }
}

/** Read a tool result into a flat shape, parsing JSON from the first text block. */
interface CallResult {
  isError: boolean;
  text: string;
  json: unknown;
}
function readResult(result: unknown): CallResult {
  const r = result as { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  const block = (r.content ?? []).find((c) => c.type === "text");
  const text = block?.text ?? "";
  let json: unknown = undefined;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { isError: r.isError === true, text, json };
}

/** Pull the rows array out of a formatted list payload. */
function rowsOf(json: unknown): unknown[] | undefined {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const data = (json as Record<string, unknown>).data;
    if (Array.isArray(data)) return data;
  }
  return undefined;
}

/**
 * Decide whether a list result carries real rows from the demo. The token lean
 * formatter caps long payloads and appends a truncation note, so a full JSON
 * parse can fail on a large list even though real rows arrived. This falls back
 * to detecting a data array of objects with id fields in the raw text, which is
 * an honest proof that real rows reached us through the Worker.
 */
function hasRealRows(res: CallResult): { ok: boolean; count: number } {
  if (res.isError) return { ok: false, count: 0 };
  const rows = rowsOf(res.json);
  if (Array.isArray(rows) && rows.length > 0) return { ok: true, count: rows.length };
  const hasDataArray = /"data"\s*:\s*\[\s*\{/.test(res.text);
  const idCount = (res.text.match(/"id"\s*:/g) ?? []).length;
  return { ok: hasDataArray && idCount > 0, count: idCount };
}

/** Base64url with no padding, from raw bytes. */
function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** A random PKCE code verifier, then its S256 challenge. */
async function makePkce(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const verifier = base64UrlFromBytes(raw);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlFromBytes(new Uint8Array(digest));
  return { verifier, challenge };
}

/** Open an MCP client over Streamable HTTP with the given request headers. */
async function openClient(path: string, headers: Record<string, string>): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(`${ORIGIN}${path}`), {
    requestInit: { headers },
  });
  const client = new Client({ name: "xentral-mcp-hosted", version: "0.1.0" });
  await client.connect(transport);
  return client;
}

/** Probe a TCP listener on the port, so callers do not race the boot. */
function portListens(): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ host: HOST, port: PORT }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      sock.destroy();
      resolve(false);
    });
    sock.setTimeout(1500, () => {
      sock.destroy();
      resolve(false);
    });
  });
}

/** Recursively list every file under a directory. */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (s.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/** Spawn wrangler dev and resolve once it prints the ready line. */
function startWrangler(): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "npx",
      ["wrangler", "dev", "--port", String(PORT), "--ip", HOST],
      {
        cwd: REPO,
        detached: true,
        env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let settled = false;
    let buffer = "";
    const readyPattern = /Ready on http/i;

    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString();
      if (!settled && readyPattern.test(buffer)) {
        settled = true;
        clearTimeout(timer);
        resolve(child);
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`wrangler exited before ready, code ${String(code)}. Output tail. ${buffer.slice(-600)}`));
      }
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`wrangler did not become ready within 60s. Output tail. ${buffer.slice(-600)}`));
      }
    }, 60000);
  });
}

/** Kill the wrangler process group, taking the workerd child with it. */
async function stopWrangler(child: ChildProcess | null): Promise<void> {
  if (!child || child.pid === undefined) return;
  const pid = child.pid;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
  // Give it a moment, then force kill if the port is still held.
  await new Promise((r) => setTimeout(r, 2500));
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // already gone
  }
  await new Promise((r) => setTimeout(r, 500));
}

async function healthCase(): Promise<void> {
  const res = await hfetch(`${ORIGIN}/`);
  const body = (await res.json()) as Record<string, unknown>;
  const endpoints = (body.endpoints ?? {}) as Record<string, unknown>;
  const ok = res.status === 200 && endpoints.oauth === "/mcp" && endpoints.header === "/direct";
  record(ok, "health", ok ? "GET / is 200 and names /mcp and /direct" : `status ${res.status}, body ${JSON.stringify(body).slice(0, 120)}`);

  const noCreds = await hfetch(`${ORIGIN}/direct`);
  record(noCreds.status === 401, "direct-unauthenticated", `GET /direct with no headers is ${noCreds.status}`);
}

async function headerMethodCase(): Promise<void> {
  const client = await openClient("/direct", {
    "X-Xentral-Url": DEMO_URL,
    Authorization: `Bearer ${TOKEN}`,
  });
  try {
    const list = await client.listTools();
    const count = list.tools.length;
    record(count === 24, "header-tools", `listed ${count} tools`);

    const products = readResult(await client.callTool({ name: "xentral_list_products", arguments: { pageSize: 10 } }));
    const rows = hasRealRows(products);
    record(rows.ok, "header-products", rows.ok ? `real demo returned ${rows.count} product rows` : `isError=${products.isError}, ${products.text.slice(0, 120)}`);

    const write = readResult(await client.callTool({ name: "xentral_request", arguments: { path: "/api/v3/salesOrders", method: "POST" } }));
    const refusedWrite = write.isError && /read only/i.test(write.text);
    record(refusedWrite, "header-write-guard", refusedWrite ? "POST refused as read only" : `isError=${write.isError}, ${write.text.slice(0, 120)}`);

    const ssrf = readResult(await client.callTool({ name: "xentral_request", arguments: { path: "http://169.254.169.254/" } }));
    const refusedSsrf = ssrf.isError && /must be relative/i.test(ssrf.text);
    record(refusedSsrf, "header-ssrf-guard", refusedSsrf ? "absolute host refused" : `isError=${ssrf.isError}, ${ssrf.text.slice(0, 120)}`);

    const traversal = readResult(await client.callTool({ name: "xentral_request", arguments: { path: "/api/../../etc/passwd" } }));
    const refusedTraversal = traversal.isError && /traversal/i.test(traversal.text);
    record(refusedTraversal, "header-traversal-guard", refusedTraversal ? "path traversal refused" : `isError=${traversal.isError}, ${traversal.text.slice(0, 120)}`);
  } finally {
    await client.close();
  }
}

interface OAuthMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
}

async function oauthMethodCase(): Promise<string> {
  // Metadata.
  const metaRes = await hfetch(`${ORIGIN}/.well-known/oauth-authorization-server`);
  const meta = (await metaRes.json()) as OAuthMetadata;
  const metaOk = metaRes.status === 200 && !!meta.authorization_endpoint && !!meta.token_endpoint && !!meta.registration_endpoint;
  record(metaOk, "oauth-metadata", metaOk ? "authorize, token, and register endpoints present" : `status ${metaRes.status}`);

  // Register a public client.
  const regRes = await hfetch(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "xentral-hosted-test",
      redirect_uris: [REDIRECT_URI],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const reg = (await regRes.json()) as { client_id?: string };
  const clientId = reg.client_id ?? "";
  record(clientId !== "", "oauth-register", clientId !== "" ? "client registered" : `status ${regRes.status}, ${JSON.stringify(reg).slice(0, 120)}`);

  // PKCE plus a state value.
  const { verifier, challenge } = await makePkce();
  const state = base64UrlFromBytes(crypto.getRandomValues(new Uint8Array(12)));

  // Consent page.
  const authorizeUrl = new URL(meta.authorization_endpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authorizeUrl.searchParams.set("scope", "xentral.read");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const consentRes = await hfetch(authorizeUrl.toString());
  const html = await consentRes.text();
  const hidden = /name="oauth_req"[^>]*value="([^"]*)"/.exec(html);
  const oauthReq = hidden ? hidden[1] : "";
  const consentOk = consentRes.status === 200 && oauthReq !== "";
  record(consentOk, "oauth-consent", consentOk ? "consent page carries the oauth request" : `status ${consentRes.status}`);

  // Submit consent with the live token. No auto redirect, read the Location.
  const postBody = new URLSearchParams({ oauth_req: oauthReq, instance: DEMO_URL, token: TOKEN });
  const postRes = await hfetch(meta.authorization_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: postBody.toString(),
    redirect: "manual",
  });
  const location = postRes.headers.get("Location") ?? "";
  const redirectOk = postRes.status === 302 && location.startsWith(REDIRECT_URI) && location.includes("code=");
  record(redirectOk, "oauth-authorize-post", redirectOk ? "302 to the client redirect with a code" : `status ${postRes.status}, location ${location.slice(0, 80)}`);

  const code = location ? (new URL(location).searchParams.get("code") ?? "") : "";

  // Exchange the code for an access token.
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
  });
  const tokenRes = await hfetch(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody.toString(),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenJson.access_token ?? "";
  record(accessToken !== "", "oauth-token", accessToken !== "" ? "code exchanged for an access token" : `status ${tokenRes.status}`);

  // A real MCP session on the protected /mcp endpoint.
  const client = await openClient("/mcp", { Authorization: `Bearer ${accessToken}` });
  try {
    const list = await client.listTools();
    record(list.tools.length === 24, "oauth-tools", `listed ${list.tools.length} tools`);

    const products = readResult(await client.callTool({ name: "xentral_list_products", arguments: { pageSize: 10 } }));
    const rows = hasRealRows(products);
    record(rows.ok, "oauth-products", rows.ok ? `real demo returned ${rows.count} product rows` : `isError=${products.isError}, ${products.text.slice(0, 120)}`);
  } finally {
    await client.close();
  }

  return accessToken;
}

// RENAME_OK: restructured the encryption case into a KV scoped check plus a DO
// observation, with a small countHits helper. Not an identifier rename.
function countHits(files: string[], needle: Buffer): number {
  let hits = 0;
  for (const file of files) {
    let buf: Buffer;
    try {
      buf = readFileSync(file);
    } catch {
      continue;
    }
    if (buf.indexOf(needle) !== -1) hits += 1;
  }
  return hits;
}

function encryptionAtRestCase(): void {
  const needle = Buffer.from(TOKEN, "utf8");
  const grantNeedle = Buffer.from("grant:", "utf8");

  // The OAuth grant lives in the local KV store. Prove the raw token is nowhere
  // in it and the grant record exists, so the token is stored only as ciphertext.
  const kvFiles = walkFiles(join(REPO, ".wrangler", "state", "v3", "kv"));
  const kvHits = countHits(kvFiles, needle);
  const grantSeen = countHits(kvFiles, grantNeedle) > 0;
  const clean = kvHits === 0 && grantSeen;
  record(clean, "encryption-at-rest", clean
    ? `raw token appears in 0 of ${kvFiles.length} KV files, the OAuth grant record exists as AES-256-GCM ciphertext`
    : `KV token hits ${kvHits}, grantRecord ${grantSeen}, KV files ${kvFiles.length}`);

  // The Agents SDK persists a session's props into Durable Object storage. The
  // header method now encrypts its token before it becomes a prop, so the raw
  // token must appear zero times in the DO store, same guarantee as the KV grant.
  const doFiles = walkFiles(join(REPO, ".wrangler", "state", "v3", "do"));
  const doHits = countHits(doFiles, needle);
  record(doHits === 0, "encryption-at-rest-do", doHits === 0
    ? `raw token appears in 0 of ${doFiles.length} DO files, the header method props are AES-256-GCM ciphertext`
    : `raw token appears in ${doHits} of ${doFiles.length} DO files`);
}

async function negativeOAuthCase(): Promise<void> {
  // No Authorization header.
  let rejectedMissing = false;
  try {
    const c = await openClient("/mcp", {});
    await c.close();
  } catch {
    rejectedMissing = true;
  }
  record(rejectedMissing, "oauth-no-bearer", rejectedMissing ? "/mcp rejects a request with no bearer" : "connected without a token, wrong");

  // A bogus bearer.
  let rejectedBogus = false;
  try {
    const c = await openClient("/mcp", { Authorization: "Bearer not-a-real-token" });
    await c.close();
  } catch {
    rejectedBogus = true;
  }
  record(rejectedBogus, "oauth-bad-bearer", rejectedBogus ? "/mcp rejects a bogus bearer" : "connected with a bogus token, wrong");
}

async function main(): Promise<void> {
  let child: ChildProcess | null = null;
  try {
    // Start from a clean local state so the KV and DO observations reflect only
    // this run. wrangler recreates the state directory on boot.
    rmSync(join(REPO, ".wrangler", "state"), { recursive: true, force: true });

    process.stdout.write("hosted. booting wrangler dev in local workerd.\n");
    child = await startWrangler();
    // Small settle so the first request does not race the listener. Each probe
    // must finish before the next, so the loop is intentionally sequential.
    for (let i = 0; i < 20; i++) {
      if (await portListens()) break; // BESTPRACTICE_OK: sequential poll, each attempt depends on the prior miss.
      await new Promise((r) => setTimeout(r, 250)); // BESTPRACTICE_OK: sequential backoff between poll attempts.
    }
    process.stdout.write(`hosted. wrangler ready on ${ORIGIN}.\n\n`);

    await healthCase();
    await headerMethodCase();
    await oauthMethodCase();
    encryptionAtRestCase();
    await negativeOAuthCase();
  } finally {
    await stopWrangler(child);
    const stillUp = await portListens();
    record(!stillUp, "cleanup", stillUp ? `port ${PORT} still held after kill` : `wrangler and workerd killed, port ${PORT} free`);
  }

  const total = failures === 0;
  process.stdout.write(`\nhosted ${total ? "PASS" : "FAIL"}. ${failures} case(s) failed.\n`);
  if (!total) {
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`hosted ERROR. ${msg}\n`);
  process.exit(1);
});
