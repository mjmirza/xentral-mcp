# Security

Your ERP is the record of your business. A connector that reaches into it has to
earn trust. This document sets out how xentral-mcp is built to protect your
credentials, your data, and your systems, and how to report a problem.

Read this together with the [LICENSE](../LICENSE), which states plainly that you
use the Software at your own risk and that the author carries no liability. The
design below reduces risk. It does not remove it. You remain responsible for how
you deploy and operate it.

## The threat model in one line

The connector holds a token that can read, and optionally write, your live ERP.
The risks that matter are a leaked token, a request steered to the wrong host, an
agent taking a write you did not intend, and a large or crafted response
disrupting your client. Each one is addressed below.

## Read by default, writes are opt-in and guarded

- The server starts in read-only mode. Nothing can change your data until you
  deliberately turn writes on.
- Write tools sit behind a single guard. When writes are off, a write tool
  refuses before any call reaches your ERP.
- This means you can hand an AI agent a look at your business while it changes
  nothing, and only widen that when you are ready.

## Credentials are never stored in the repository

- No token, no key, and no instance URL is committed anywhere in this project.
- Local configuration lives in ignored files (`.env`, `.dev.vars`) that git never
  tracks.
- The hosted option stores your Personal Access Token encrypted, see below, and
  never in plain text.

## Tokens at rest are encrypted (hosted option)

- On the hosted Cloudflare path, your Personal Access Token is encrypted with
  AES-256-GCM using WebCrypto before it is written to storage, with a fresh 12
  byte IV per record.
- The encryption key is a server secret, set out of band, and is never placed in
  the repository or in any config file. It is run through HKDF-SHA-256 (a real
  key derivation function) with a fixed salt and info label to derive the AES key,
  and a secret shorter than 32 characters is refused up front, so a weak key
  cannot be set.
- Each grant is keyed by the instance host and a one-way fingerprint of the token,
  so two distinct tokens on the same instance get separate grants and never
  overwrite one another.
- A stored record that is malformed, tampered with, or encrypted under a
  different key fails closed with a clear error rather than leaking anything.
- You can revoke the authorization in your client at any time, which deletes the
  stored grant and its encrypted token. You should then also delete the Personal
  Access Token in your Xentral admin.

## Requests cannot be steered to the wrong host (SSRF defense)

- The base URL you supply is validated before any request is made. It must be
  https, unless you explicitly opt in to plain http for local work.
- A URL that carries embedded credentials in the userinfo part is rejected.
- Requests to loopback, link-local, and internal names, to raw IPv4 literals,
  and to IPv6 colon hosts are blocked by default, so a crafted host cannot turn
  the connector into a probe of your internal network. Opt-in flags exist for the
  narrow cases where a private host is genuinely intended.
- Path handling rejects traversal attempts, including percent-encoded and
  backslash forms, and a query or fragment in the path, so a tool argument cannot
  climb outside the intended API path or smuggle a second query onto the URL.
- The outbound fetch never follows a redirect (`redirect: "manual"`), so a 3xx to
  an internal host cannot be used to pivot.

### Residual risk, DNS rebinding on the hosted path

The check above validates the hostname you supply, not the IP address it resolves
to. A hostname that passes the check could, in principle, resolve to a private or
loopback address (DNS rebinding). This matters only on the multi tenant hosted
worker, where the instance host is supplied by an untrusted tenant. On the local
stdio path the host is your own and trusted, so there is nothing to rebind.

If you run the hosted worker for untrusted tenants, place a hard network egress
control in front of it, an egress firewall or an allowlist of known Xentral
hostnames or IP ranges, so the platform, not only the hostname check, bounds where
the worker can connect. The hostname check is defense in depth. The network egress
control is the layer that closes this gap.

## Secrets are redacted from errors and logs

- Error messages and any surfaced output run through a redaction pass that
  removes the token, including its URL-encoded form, before anything is shown.
- The goal is that a stack trace or an error bubbling up to your AI client never
  carries your credential.

## Responses are bounded

- Responses are read with a size cap, so a very large or hostile payload cannot
  exhaust memory in your client or the worker.
- Output strips empty fields by default to keep results lean, with an explicit
  verbose mode when you want the full payload.

## Rate limits are respected

- The client honors the ERP rate limit and backs off and retries on a limit
  response, rather than hammering your instance.

## The hosted consent surface is locked down

- The OAuth consent page ships with a strict Content-Security-Policy, denies
  framing, disables content-type sniffing, sends a no-referrer policy, and marks
  its responses no-store, to reduce the surface for clickjacking and leakage.

## What is still your responsibility

The [LICENSE](../LICENSE) is explicit that the Software is provided as is,
without warranty, and that the author takes no responsibility for your
deployment. In practice that means the following are on you.

- Scope the Personal Access Token to the least it needs, and rotate it if it may
  have been exposed.
- Keep writes off until you have tested against a demo or sandbox instance.
- Protect the machine and the client where the connector runs.
- Review what an AI agent is about to do before you enable write actions.
- Meet your own obligations under the Xentral API terms and under data
  protection law for the data you move.

## Reporting a vulnerability

If you find a security issue, please do not open a public issue. Contact the
author privately through the channels in the [README](../README.md) with enough
detail to reproduce it. Reports are welcome and will be handled in good faith.
