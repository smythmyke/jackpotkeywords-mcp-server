# jackpotkeywords-mcp-server

[![npm version](https://img.shields.io/npm/v/jackpotkeywords-mcp-server.svg)](https://www.npmjs.com/package/jackpotkeywords-mcp-server)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-active-2da44e)](https://registry.modelcontextprotocol.io/v0/servers?search=jackpotkeywords)
[![Glama](https://img.shields.io/badge/Glama-listed-blue)](https://glama.ai/mcp/servers/smythmyke/jackpotkeywords-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

MCP (Model Context Protocol) server for [JackpotKeywords](https://jackpotkeywords.web.app) — AI-powered keyword research and AI-visibility scanning. Lets Claude Code, Claude Desktop, Cursor, Windsurf, and other MCP-compatible clients call JackpotKeywords directly.

Three tools available: `jackpotkeywords_credit_balance`, `jackpotkeywords_recommend`, `jackpotkeywords_aeo_scan`.

## Prerequisites

1. A JackpotKeywords API key — generate one at https://jackpotkeywords.web.app/developers (instant, self-serve, $5 starter credit, no card required).
2. Node.js 18 or newer (only if installing locally; `npx` doesn't require a local Node.js if your MCP client bundles one).

## Configure in Claude Code

**Recommended — use the CLI:**

```bash
claude mcp add -s user jackpotkeywords \
  -e JACKPOTKEYWORDS_API_KEY=jk_live_... \
  -- npx -y jackpotkeywords-mcp-server
```

That writes the server to your user-scope config (`~/.claude.json`) so it's available in every Claude Code session, in every project. Verify with `claude mcp list`.

**Or hand-edit** `~/.claude.json` (user scope) or `.mcp.json` in the project root (project scope), adding to the `mcpServers` object:

```jsonc
{
  "mcpServers": {
    "jackpotkeywords": {
      "command": "npx",
      "args": ["-y", "jackpotkeywords-mcp-server"],
      "env": {
        "JACKPOTKEYWORDS_API_KEY": "jk_live_..."
      }
    }
  }
}
```

**Important:** Claude Code does **not** read `~/.claude/mcp.json` (with the slash). The real user-scope path is `~/.claude.json` (with the dot). Use the CLI to avoid this trap.

**Restart any open Claude Code session** to pick up the new tools — MCP servers load at session start, not dynamically.

## Configure in Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```jsonc
{
  "mcpServers": {
    "jackpotkeywords": {
      "command": "npx",
      "args": ["-y", "jackpotkeywords-mcp-server"],
      "env": {
        "JACKPOTKEYWORDS_API_KEY": "jk_live_..."
      }
    }
  }
}
```

## Configure in Cursor

Cursor uses the same JSON shape. Settings → MCP → Add Server:

```jsonc
{
  "mcpServers": {
    "jackpotkeywords": {
      "command": "npx",
      "args": ["-y", "jackpotkeywords-mcp-server"],
      "env": { "JACKPOTKEYWORDS_API_KEY": "jk_live_..." }
    }
  }
}
```

## Tools

### `jackpotkeywords_credit_balance`

Returns the current credit balance for your API account.

No arguments. Use it to verify your key works and to check credits before calling the paid tools.

### `jackpotkeywords_recommend`

Runs the full keyword research pipeline for a product and returns ranked recommendations by composite Jackpot Score (volume, CPC, competition, trend, cluster strength, AI relevance). Backed by real Google Ads Keyword Planner data.

**Cost: $0.10 per call** (flat — regardless of `limit`). Refunded on pipeline failure. Latency ~60–180s.

| Argument | Type | Required | Description |
|---|---|---|---|
| `url` | string | one-of | Product URL to extract context from |
| `description` | string | one-of | Plain-English product description |
| `limit` | number | no | Max recommendations to return. Default 50, max 200. |
| `budget` | number | no | Daily ad budget in USD (influences AI scoring) |
| `location` | string | no | Location for local-intent boosting |

Returns: top 25 recommendations as a readable table in `content`, with the full ranked list in `structuredContent.recommendations`.

**Example prompt (in Claude Code):**

> Use jackpotkeywords_recommend on https://bulklistingpro.com — find keywords I should target for SEO and Google Ads for an eBay bulk listing tool. Limit 50.

### `jackpotkeywords_aeo_scan`

Runs an AI-visibility scan. Asks 10 buyer-intent queries about your product through Gemini's grounded search and reports, per query: whether the URL was cited as a source, mentioned in the answer text, or absent — plus the top sources the AI did cite.

**Cost: $1.00 per scan** (refunded on failure). Latency ~30–120s.

| Argument | Type | Required | Description |
|---|---|---|---|
| `url` | string | yes | Product URL to scan |
| `productContext` | object | no | Pre-extracted product context (skip extraction step) |

Returns: visibility score + per-query results in `content`, full structured data in `structuredContent.queries`.

**Example prompt:**

> Run jackpotkeywords_aeo_scan on https://markitup.app and tell me which queries we're missing from.

## Environment variables

| Var | Required | Description |
|---|---|---|
| `JACKPOTKEYWORDS_API_KEY` | yes | API key from https://jackpotkeywords.web.app/developers |
| `JACKPOTKEYWORDS_API_BASE` | no | Override the API base URL. Default: `https://jackpotkeywords.web.app/api/v1`. Useful for testing against staging. |

## Pricing reference

- `$5 starter credit` on signup (no card, no expiration)
- `/v1/recommend` — $0.10/call (≈ 50 calls per $5)
- `/v1/aeo-scan` — $1.00/call (≈ 5 calls per $5)
- Topup via Stripe checkout (`POST /v1/topup`) in $25 / $100 / $500 packs or custom ≥ $25
- Rate limit: 60 requests/min, 1000/hr per key

## Local development

```bash
git clone https://github.com/smythmyke/jackpotkeywords-mcp-server.git
cd jackpotkeywords-mcp-server
npm install
npm run build

# Point your MCP client config at the local build:
{
  "command": "node",
  "args": ["/absolute/path/to/jackpotkeywords-mcp-server/dist/index.js"],
  "env": { "JACKPOTKEYWORDS_API_KEY": "jk_live_..." }
}
```

## Security

- Never commit `JACKPOTKEYWORDS_API_KEY` to source control.
- If you accidentally expose a key, revoke it at https://jackpotkeywords.web.app/developers and create a new one (`POST /v1/keys` + `DELETE /v1/keys/:keyId`).
- Keys are SHA-256 hashed on the server; the raw key is shown only once at creation.

## Errors

The server surfaces clean human-readable errors for the common cases:

- `Invalid or missing JACKPOTKEYWORDS_API_KEY` — set or rotate the key.
- `Insufficient balance` — top up at https://jackpotkeywords.web.app/developers.
- `Rate limit exceeded` — wait briefly and retry.

## License

MIT
