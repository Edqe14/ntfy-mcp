# ntfy-mcp

Standalone MCP server for sending notifications to `ntfy.sh` or any self-hosted ntfy instance.

This server is reusable across MCP clients. It exposes tools for sending notifications, while keeping the ntfy URL and topic locked at server startup so agents cannot override them per call.

## Features

- `stdio` MCP server for broad client compatibility
- locked `ntfy` base URL and topic
- startup config via flags or environment variables
- bearer token or basic auth support
- `ntfy_publish` tool for general notifications
- `ntfy_ping` tool for simple "finished working" notifications

## Install

### Local development

```bash
npm install
npm run build
```

### Published CLI

After publishing, clients can run the server directly with `npx`:

```bash
npx -y ntfy-mcp --ntfy-url https://ntfy.sh --ntfy-topic my-topic
```

## Smoke test

You can run a local MCP-level smoke test after building:

```bash
node scripts/smoke-test.mjs dist/index.js \
  --ntfy-url https://ntfy.sh \
  --ntfy-topic my-test-topic
```

## Configuration

Flags take priority over environment variables.

### Flags

```bash
node dist/index.js \
  --ntfy-url https://ntfy.sh \
  --ntfy-topic my-topic \
  --ntfy-token tk_your_token
```

### Environment variables

```bash
export NTFY_URL="https://ntfy.sh"
export NTFY_TOPIC="my-topic"
export NTFY_TOKEN="tk_your_token"
node dist/index.js
```

Supported variables:

- `NTFY_URL`
- `NTFY_TOPIC`
- `NTFY_TOKEN`
- `NTFY_USERNAME`
- `NTFY_PASSWORD`

If both token auth and basic auth are configured, token auth wins.

## Tool reference

### `ntfy_publish`

Sends a notification to the configured topic.

Input:

```json
{
  "message": "Deployment complete",
  "title": "Deploy",
  "priority": "high",
  "tags": ["rocket", "white_check_mark"],
  "markdown": false,
  "click": "https://example.com/deploys/123",
  "icon": "https://example.com/icon.png",
  "delay": "10m"
}
```

### `ntfy_ping`

Convenience tool for simple pings.

Input:

```json
{
  "message": "Agent finished working.",
  "title": "Agent finished",
  "priority": "default",
  "tags": ["robot_face", "white_check_mark"]
}
```

## npm publish

This package is set up to publish as a public npm CLI.

```bash
npm login
npm publish
```

Quick checks before publishing:

```bash
npm run build
npm pack --dry-run
```

## skills.sh skill

This repository also contains a reusable skill in the `skills/` directory:

- `skills/ntfy-after-task/SKILL.md`

After pushing the repo, it can be installed through `skills.sh` with:

```bash
npx skills add Edqe14/ntfy-mcp@ntfy-after-task
```

## OpenCode

Register the server in `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "ntfy": {
      "type": "local",
      "command": [
        "npx",
        "-y",
        "ntfy-mcp",
        "--ntfy-url",
        "https://ntfy.sh",
        "--ntfy-topic",
        "my-topic"
      ]
    }
  }
}
```

This only makes the tool available. To send a ping after the agent finishes working, OpenCode still needs a plugin, hook, or workflow that calls `ntfy_ping` when the session becomes idle or reaches your chosen completion event.

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ntfy": {
      "command": "npx",
      "args": [
        "-y",
        "ntfy-mcp",
        "--ntfy-url",
        "https://ntfy.sh",
        "--ntfy-topic",
        "my-topic"
      ]
    }
  }
}
```

## Cursor

Add to `.cursor/mcp.json` or `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "ntfy": {
      "command": "npx",
      "args": [
        "-y",
        "ntfy-mcp",
        "--ntfy-url",
        "https://ntfy.sh",
        "--ntfy-topic",
        "my-topic"
      ]
    }
  }
}
```

## Notes

- The server publishes with HTTP `POST` to `https://<ntfy-host>/<topic>`.
- ntfy URL and topic are intentionally locked at startup.
- Per-call overrides for URL or topic are not supported.
- Use `console.error` for logs because stdout is reserved for MCP protocol traffic.
