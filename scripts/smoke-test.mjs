import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [, , serverPath, ...serverArgs] = process.argv;

if (!serverPath) {
  console.error("Usage: node scripts/smoke-test.mjs <server-path> [server args...]");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath, ...serverArgs]
});

const client = new Client({
  name: "ntfy-mcp-smoke-test",
  version: "0.1.0"
});

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "ntfy_ping",
    arguments: {
      message: "Smoke test ping from MCP client.",
      title: "ntfy-mcp smoke test"
    }
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.close();
}
