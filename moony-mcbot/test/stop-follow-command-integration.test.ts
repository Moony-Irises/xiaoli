import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startDebugWebServer } from "../src/debug/debug-server.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type {
  ActionResult,
  ClientCapability
} from "../src/runtime/client-adapter.js";
import {
  executeAgentToolCall,
  getCommandInvocationHistoryForDebug,
  registerActionTools,
  stopActionRuntime
} from "../src/tools/action-tools.js";
import type { BotCreateInput } from "../src/types.js";
import { FakeClientAdapter } from "./helpers/fake-client-adapter.js";

interface HttpResult {
  statusCode: number;
  body: string;
}

interface McpToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}

interface McpServerInternals {
  _registeredTools: Record<string, {
    handler: (
      args: { botId: string },
      extra: never
    ) => McpToolResponse | Promise<McpToolResponse>;
  }>;
}

class StopFollowClientAdapter extends FakeClientAdapter {
  stopMovementCount = 0;

  override supportsCapability(capability: ClientCapability): boolean {
    return capability === "stop_follow" || capability === "stop_movement";
  }

  override async stopMovement(): Promise<ActionResult> {
    this.stopMovementCount += 1;
    return { ok: true, detail: "movement stopped" };
  }
}

function createBotInput(botId: string): BotCreateInput {
  return {
    botId,
    authApiBaseUrl: "http://127.0.0.1:3000",
    username: "command-test-user",
    password: "not-used",
    serverHost: "127.0.0.1",
    autoReconnect: false
  };
}

function createRegistry(botId: string): BotRegistry {
  const registry = new BotRegistry({
    clientAdapterKind: "modded-client",
    clientAdapterFactory: {
      create: () => new StopFollowClientAdapter("modded-client")
    }
  });
  registry.create(createBotInput(botId));
  return registry;
}

async function getFreePort(): Promise<number> {
  const probe = http.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  if (!address || typeof address === "string") {
    throw new Error("Could not allocate a test port");
  }
  return address.port;
}

async function request(
  port: number,
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<HttpResult> {
  return await new Promise<HttpResult>((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path,
        method: options.method ?? "GET",
        headers: options.body
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(options.body) }
          : undefined
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );
    req.once("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

test("Agent move.stopFollow preserves its text and records a command result", async () => {
  const botId = "agent-stop-follow";
  const registry = createRegistry(botId);

  assert.equal(
    await executeAgentToolCall(botId, registry, "move.stopFollow", {}),
    "stopped follow"
  );

  const history = getCommandInvocationHistoryForDebug(registry, { botId });
  assert.equal(history.length, 1);
  assert.equal(history[0]?.commandId, "move.stopFollow");
  assert.equal(history[0]?.source, "agent");
  assert.equal(history[0]?.status, "executed");
  assert.deepEqual(history[0]?.output, {
    botId,
    stopped: true,
    message: "Stopped following"
  });
});

test("MCP move.stopFollow preserves tool-level success and failure responses", async () => {
  const botId = "mcp-stop-follow";
  const registry = createRegistry(botId);
  const server = new McpServer({ name: "stop-follow-command-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const handler = internals._registeredTools["move.stopFollow"]?.handler;
    assert.ok(handler);

    const success = await handler({ botId }, {} as never);
    assert.equal(success.isError, undefined);
    assert.equal(success.content[0]?.text, "Stopped following");

    const failure = await handler({ botId: "missing-stop-follow" }, {} as never);
    assert.equal(failure.isError, true);
    assert.match(failure.content[0]?.text ?? "", /not found/i);

    const history = getCommandInvocationHistoryForDebug(registry);
    assert.deepEqual(
      history.map((entry) => ({ source: entry.source, status: entry.status, botId: entry.botId })),
      [
        { source: "mcp", status: "failed", botId: "missing-stop-follow" },
        { source: "mcp", status: "executed", botId }
      ]
    );
  } finally {
    await stopActionRuntime();
    await server.close();
  }
});

test("Web stop-follow preserves its endpoint and exposes cross-entry command history", async () => {
  const envNames = [
    "MCBOT_DEBUG_WEB_ENABLED",
    "MCBOT_DEBUG_WEB_HOST",
    "MCBOT_DEBUG_WEB_PORT",
    "MCBOT_DEBUG_WEB_AUTH_TOKEN"
  ];
  const previousEnv = new Map<string, string | undefined>(
    envNames.map((name) => [name, process.env[name]])
  );
  const botId = "web-stop-follow";
  const registry = createRegistry(botId);
  const port = await getFreePort();
  let server: http.Server | null = null;

  try {
    process.env.MCBOT_DEBUG_WEB_ENABLED = "true";
    process.env.MCBOT_DEBUG_WEB_HOST = "127.0.0.1";
    process.env.MCBOT_DEBUG_WEB_PORT = String(port);
    delete process.env.MCBOT_DEBUG_WEB_AUTH_TOKEN;

    server = startDebugWebServer(registry);
    assert.ok(server);
    await new Promise<void>((resolve) => server?.once("listening", resolve));

    const success = await request(port, "/api/action/stop-follow", {
      method: "POST",
      body: JSON.stringify({ botId })
    });
    assert.equal(success.statusCode, 200);
    assert.deepEqual(JSON.parse(success.body), {
      botId,
      stopped: true,
      message: "Stopped following"
    });

    const failure = await request(port, "/api/action/stop-follow", {
      method: "POST",
      body: JSON.stringify({ botId: "missing-stop-follow" })
    });
    assert.equal(failure.statusCode, 500);
    assert.match(failure.body, /not found/i);

    const debugResponse = await request(port, `/api/debug?botId=${encodeURIComponent(botId)}`);
    assert.equal(debugResponse.statusCode, 200);
    const payload = JSON.parse(debugResponse.body) as {
      commandHistory?: Array<{ commandId: string; source: string; status: string }>;
      actionHistory?: Array<{ action: string; ok: boolean }>;
    };
    assert.deepEqual(
      payload.commandHistory?.map((entry) => ({
        commandId: entry.commandId,
        source: entry.source,
        status: entry.status
      })),
      [{ commandId: "move.stopFollow", source: "web", status: "executed" }]
    );
    assert.equal(payload.actionHistory?.[0]?.action, "stop-follow");
    assert.equal(payload.actionHistory?.[0]?.ok, true);

    assert.deepEqual(
      getCommandInvocationHistoryForDebug(registry).map((entry) => ({
        source: entry.source,
        status: entry.status,
        botId: entry.botId
      })),
      [
        { source: "web", status: "failed", botId: "missing-stop-follow" },
        { source: "web", status: "executed", botId }
      ]
    );
  } finally {
    await new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
    });
    for (const [name, value] of previousEnv) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
