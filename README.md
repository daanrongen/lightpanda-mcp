# lightpanda-mcp

MCP server for [Lightpanda](https://lightpanda.io/) — navigate pages, extract content, click elements, fill forms, take screenshots, and evaluate JavaScript over stdio.

## Installation

```bash
bunx @daanrongen/lightpanda-mcp
```

## Tools (6 total)

| Domain     | Tools                                                            | Coverage                                                      |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------- |
| **Browse** | `navigate`, `get_content`, `click`, `fill`, `screenshot`, `evaluate` | Page navigation, content extraction, interaction, JS evaluation |

## Configuration

| Variable          | Required | Description                                                    |
| ----------------- | -------- | -------------------------------------------------------------- |
| `LIGHTPANDA_URL`  | Yes      | Lightpanda CDP WebSocket URL (e.g. `ws://localhost:9222`)      |

## Setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lightpanda": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@daanrongen/lightpanda-mcp"],
      "env": {
        "LIGHTPANDA_URL": "ws://localhost:9222"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add lightpanda -e LIGHTPANDA_URL=ws://localhost:9222 -- bunx @daanrongen/lightpanda-mcp
```

## Development

```bash
bun install
bun run dev        # run with --watch
bun test           # run test suite
bun run lint       # lint and check formatting
bun run typecheck  # type check
bun run build      # bundle to dist/main.js
bun run inspect    # open MCP Inspector in browser
```

## Inspecting locally

`bun run inspect` launches the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against the local build:

```bash
bun run build && bun run inspect
```

This opens the Inspector UI in your browser where you can call any tool interactively and inspect request/response shapes.

## Architecture

```
src/
├── config.ts                        # Effect Config — LIGHTPANDA_URL
├── main.ts                          # Entry point — ManagedRuntime + StdioServerTransport
├── domain/
│   ├── LightpandaClient.ts          # Context.Tag service interface
│   ├── errors.ts                    # LightpandaError, NavigationError, EvalError
│   └── models.ts                    # Schema.Class models (PageContent, Link)
├── infra/
│   ├── LightpandaClientLive.ts      # Layer.scoped — connects via puppeteer-core CDP
│   └── LightpandaClientTest.ts      # In-memory Ref-based test adapter
└── mcp/
    ├── server.ts                    # McpServer wired to ManagedRuntime
    ├── utils.ts                     # runTool, formatSuccess, formatError
    └── tools/
        └── browse.ts                # navigate, get_content, click, fill, screenshot, evaluate
```

## License

MIT
