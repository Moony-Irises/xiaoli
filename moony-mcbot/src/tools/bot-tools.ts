import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BotRegistry } from "../runtime/bot-registry.js";
import { RuntimeStatus } from "../types.js";

interface ToolResponse {
  content: { type: "text"; text: string }[];
  isError?: boolean;
  [key: string]: unknown;
}

function ok(text: string): ToolResponse {
  return { content: [{ type: "text", text }] };
}

function fail(message: string): ToolResponse {
  return { content: [{ type: "text", text: message }], isError: true };
}

function statusText(status: RuntimeStatus): string {
  return JSON.stringify(status, null, 2);
}

const optionalFlexibleBoolean = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return undefined;
    if (["true", "1", "yes", "y", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "off"].includes(normalized)) return false;
    return value;
  },
  z.boolean().optional()
);

function resolveRuntimeForConnect(registry: BotRegistry, botId?: string) {
  if (botId) {
    return registry.get(botId);
  }

  const ids = registry.listBotIds();
  if (ids.length === 1) {
    return registry.get(ids[0]);
  }

  if (ids.length === 0) {
    throw new Error("No bot instances found. Call bot.create first.");
  }

  throw new Error(`botId is required because multiple instances exist: ${ids.join(", ")}`);
}

export function registerBotTools(server: McpServer, registry: BotRegistry): void {
  server.tool(
    "bot.create",
    "Create a bot runtime instance with auth and server config",
    {
      botId: z.string().min(1),
      authApiBaseUrl: z.string().url(),
      username: z.string().min(1),
      password: z.string().min(1),
      serverHost: z.string().min(1),
      serverPort: z.number().int().min(1).max(65535).optional(),
      useSrv: optionalFlexibleBoolean,
      version: z.string().optional(),
      autoReconnect: optionalFlexibleBoolean,
      maxAutoReconnectAttempts: z.number().int().min(1).max(100).optional(),
      reconnectBaseDelayMs: z.number().int().min(100).max(60000).optional(),
      reconnectMaxDelayMs: z.number().int().min(100).max(300000).optional(),
      connectMaxRetries: z.number().int().min(0).max(20).optional()
    },
    async (args): Promise<ToolResponse> => {
      try {
        const runtime = registry.create(args);
        return ok(`Created bot runtime:\n${statusText(runtime.getStatus())}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "bot.connect",
    "Authenticate and connect bot to Minecraft server. If botId is omitted, connects the only existing instance.",
    {
      botId: z.string().min(1).optional(),
      maxRetries: z.number().int().min(0).max(20).optional()
    },
    async ({ botId, maxRetries }): Promise<ToolResponse> => {
      try {
        const runtime = resolveRuntimeForConnect(registry, botId);
        const status = await runtime.connect({ maxRetries });
        return ok(`Bot connected successfully:\n${statusText(status)}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "bot.status",
    "Get current bot runtime status",
    { botId: z.string().min(1) },
    async ({ botId }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        return ok(statusText(runtime.getStatus()));
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "bot.disconnect",
    "Disconnect bot from server",
    {
      botId: z.string().min(1),
      reason: z.string().optional()
    },
    async ({ botId, reason }): Promise<ToolResponse> => {
      try {
        const runtime = registry.get(botId);
        const status = await runtime.disconnect(reason);
        return ok(`Bot disconnected:\n${statusText(status)}`);
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    }
  );

  server.tool(
    "bot.list",
    "List all bot runtime IDs",
    {},
    async (): Promise<ToolResponse> => {
      return ok(JSON.stringify({ botIds: registry.listBotIds() }, null, 2));
    }
  );
}
