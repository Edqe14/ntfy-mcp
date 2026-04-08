#!/usr/bin/env node

import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

type NtfyAuth =
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string }
  | { type: "none" };

type ServerConfig = {
  ntfyUrl: string;
  ntfyTopic: string;
  auth: NtfyAuth;
};

const HELP_TEXT = `ntfy-mcp

Standalone MCP server for publishing notifications to ntfy.

Flags:
  --ntfy-url <url>         Locked ntfy base URL (default: env NTFY_URL or https://ntfy.sh)
  --ntfy-topic <topic>     Locked ntfy topic (default: env NTFY_TOPIC)
  --ntfy-token <token>     Bearer token auth (default: env NTFY_TOKEN)
  --ntfy-username <user>   Basic auth username (default: env NTFY_USERNAME)
  --ntfy-password <pass>   Basic auth password (default: env NTFY_PASSWORD)
  --help                   Show this help text

Notes:
  - Flags override environment variables.
  - URL and topic are locked at server startup and cannot be overridden by tool calls.
`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
  throw new Error(message);
}

function normalizeBaseUrl(input: string): string {
  const parsed = new URL(input);
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/+$/, "");
}

function resolveConfig(): ServerConfig {
  const { values } = parseArgs({
    options: {
      "ntfy-url": { type: "string" },
      "ntfy-topic": { type: "string" },
      "ntfy-token": { type: "string" },
      "ntfy-username": { type: "string" },
      "ntfy-password": { type: "string" },
      help: { type: "boolean" }
    },
    allowPositionals: false
  });

  if (values.help) {
    console.error(HELP_TEXT);
    process.exit(0);
  }

  const rawUrl = values["ntfy-url"] ?? process.env.NTFY_URL ?? "https://ntfy.sh";
  const rawTopic = values["ntfy-topic"] ?? process.env.NTFY_TOPIC;
  const token = values["ntfy-token"] ?? process.env.NTFY_TOKEN;
  const username = values["ntfy-username"] ?? process.env.NTFY_USERNAME;
  const password = values["ntfy-password"] ?? process.env.NTFY_PASSWORD;

  if (!rawTopic) {
    fail("Missing ntfy topic. Set --ntfy-topic or NTFY_TOPIC.");
  }

  let auth: NtfyAuth = { type: "none" };
  if (token) {
    auth = { type: "bearer", token };
  } else if (username || password) {
    if (!username || !password) {
      fail("Basic auth requires both username and password.");
    }
    auth = { type: "basic", username, password };
  }

  return {
    ntfyUrl: normalizeBaseUrl(rawUrl),
    ntfyTopic: rawTopic,
    auth
  };
}

function buildPublishUrl(config: ServerConfig): string {
  const encodedTopic = config.ntfyTopic
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${config.ntfyUrl}/${encodedTopic}`;
}

function buildHeaders(config: ServerConfig, input: PublishInput): Headers {
  const headers = new Headers();
  headers.set("Content-Type", input.markdown ? "text/markdown; charset=utf-8" : "text/plain; charset=utf-8");

  if (input.title) headers.set("Title", input.title);
  if (input.priority) headers.set("Priority", input.priority);
  if (input.tags.length > 0) headers.set("Tags", input.tags.join(","));
  if (input.markdown) headers.set("Markdown", "yes");
  if (input.click) headers.set("Click", input.click);
  if (input.icon) headers.set("Icon", input.icon);
  if (input.delay) headers.set("Delay", input.delay);

  if (config.auth.type === "bearer") {
    headers.set("Authorization", `Bearer ${config.auth.token}`);
  }

  if (config.auth.type === "basic") {
    const encoded = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString("base64");
    headers.set("Authorization", `Basic ${encoded}`);
  }

  return headers;
}

const publishSchema = z.object({
  message: z.string().min(1, "message is required"),
  title: z.string().min(1).optional(),
  priority: z.enum(["min", "low", "default", "high", "max", "urgent", "1", "2", "3", "4", "5"]).optional(),
  tags: z.array(z.string().min(1)).default([]),
  markdown: z.boolean().default(false),
  click: z.string().url().optional(),
  icon: z.string().url().optional(),
  delay: z.string().min(1).optional()
});

const pingSchema = z.object({
  message: z.string().min(1).default("Agent finished working."),
  title: z.string().min(1).default("Agent finished"),
  priority: z.enum(["min", "low", "default", "high", "max", "urgent", "1", "2", "3", "4", "5"]).default("default"),
  tags: z.array(z.string().min(1)).default(["robot_face", "white_check_mark"]),
  markdown: z.boolean().default(false),
  click: z.string().url().optional(),
  icon: z.string().url().optional(),
  delay: z.string().min(1).optional()
});

type PublishInput = z.infer<typeof publishSchema>;
type PingInput = z.infer<typeof pingSchema>;

async function publishMessage(config: ServerConfig, input: PublishInput) {
  const url = buildPublishUrl(config);
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(config, input),
    body: input.message
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`ntfy publish failed with ${response.status}: ${responseText || response.statusText}`);
  }

  return {
    url,
    topic: config.ntfyTopic,
    status: response.status,
    responseText
  };
}

const config = resolveConfig();
const server = new McpServer(
  {
    name: "ntfy-mcp",
    version: "0.1.0"
  },
  {
    capabilities: {
      logging: {}
    }
  }
);

server.registerTool(
  "ntfy_publish",
  {
    title: "Publish ntfy notification",
    description: "Send a notification to the server-configured ntfy topic.",
    inputSchema: publishSchema.shape,
    outputSchema: {
      url: z.string(),
      topic: z.string(),
      status: z.number(),
      responseText: z.string()
    }
  },
  async (args) => {
    const input = publishSchema.parse(args);
    const result = await publishMessage(config, input);
    return {
      content: [
        {
          type: "text",
          text: `Published notification to ${result.url} (${result.status}).`
        }
      ],
      structuredContent: result
    };
  }
);

server.registerTool(
  "ntfy_ping",
  {
    title: "Send finished-work ping",
    description: "Send a simple notification to the server-configured ntfy topic.",
    inputSchema: pingSchema.shape,
    outputSchema: {
      url: z.string(),
      topic: z.string(),
      status: z.number(),
      responseText: z.string()
    }
  },
  async (args) => {
    const input: PingInput = pingSchema.parse(args);
    const result = await publishMessage(config, input);
    return {
      content: [
        {
          type: "text",
          text: `Sent ping to ${result.url} (${result.status}).`
        }
      ],
      structuredContent: result
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`ntfy-mcp running on stdio for topic '${config.ntfyTopic}' at '${config.ntfyUrl}'.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
