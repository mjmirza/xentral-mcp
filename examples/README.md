# Examples

Configuration templates you copy and fill in. None of these hold real credentials
or account ids, so add your own before you use them.

| File | What it is |
|---|---|
| [.env.example](.env.example) | Environment variables for the local stdio server |
| [claude_desktop_config.json](claude_desktop_config.json) | A Claude Desktop MCP server entry, paste it into your config |
| [wrangler.jsonc.example](wrangler.jsonc.example) | The Cloudflare Worker deploy config for the hosted option. Copy it to `wrangler.jsonc` at the repo root and fill in your own ids |

## Claude Desktop, quick use

1. Open your Claude Desktop config file. On macOS it lives at
   `~/Library/Application Support/Claude/claude_desktop_config.json`. On Windows it
   lives at `%APPDATA%\Claude\claude_desktop_config.json`.
2. Paste the block from [claude_desktop_config.json](claude_desktop_config.json)
   into it, inside your existing `mcpServers` object.
3. Replace the instance URL and the token with your own.
4. Fully quit and reopen Claude Desktop, then ask "List the first five products from Xentral."

Or run `npx xentral-mcp setup`, which writes the config for you after checking your
token against your live instance.
