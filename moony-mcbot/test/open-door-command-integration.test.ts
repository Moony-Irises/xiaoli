import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startDebugWebServer } from "../src/debug/debug-server.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type {
  ActionResult,
  ClientCapability,
  OpenDoorInput
} from "../src/runtime/client-adapter.js";
import {
  executeAgentToolCall,
  getCommandInvocationHistoryForDebug,
  registerActionTools,
  stopActionRuntime
} from "../src/tools/action-tools.js";
import type { BotCreateInput, RuntimeState } from "../src/types.js";
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
      args: OpenDoorInput & { botId: string },
      extra: never
    ) => McpToolResponse | Promise<McpToolResponse>;
  }>;
}

interface RuntimeStateInternals {
  state: RuntimeState;
}

class OpenDoorClientAdapter extends FakeClientAdapter {
  readonly calls: OpenDoorInput[] = [];

  override supportsCapability(capability: ClientCapability): boolean {
    return capability === "open_door";
  }

  override async openDoor(input: OpenDoorInput = {}): Promise<ActionResult> {
    this.calls.push({ ...input });
    return {
      ok: true,
      detail: `toggled door reach=${String(input.reach)} radius=${String(input.radius)}`
    };
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

function createRegistry(botId: string): { registry: BotRegistry; adapter: OpenDoorClientAdapter } {
  const adapter = new OpenDoorClientAdapter("modded-client");
  const registry = new BotRegistry({
    clientAdapterKind: "modded-client",
    clientAdapterFactory: {
      create: () => adapter
    }
  });
  const runtime = registry.create(createBotInput(botId));
  (runtime as unknown as RuntimeStateInternals).state = "spawned";
  adapter.setRuntimeState("spawned");
  return { registry, adapter };
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

test("Agent interact.openDoor preserves numeric conversion, defaults, and result text", async () => {
  const botId = "agent-open-door";
  const { registry, adapter } = createRegistry(botId);

  assert.equal(
    await executeAgentToolCall(
      botId,
      registry,
      "interact.openDoor",
      { reach: "5.5", radius: "7" }
    ),
    "toggled door reach=5.5 radius=7"
  );
  assert.equal(
    await executeAgentToolCall(botId, registry, "interact.openDoor", {}),
    "toggled door reach=4.5 radius=6"
  );
  assert.equal(
    await executeAgentToolCall(
      botId,
      registry,
      "interact.openDoor",
      { reach: "not-a-number", radius: "also-not-a-number" }
    ),
    "toggled door reach=NaN radius=NaN"
  );
  assert.deepEqual(adapter.calls, [
    { reach: 5.5, radius: 7 },
    { reach: 4.5, radius: 6 },
    { reach: Number.NaN, radius: Number.NaN }
  ]);

  await assert.rejects(
    executeAgentToolCall(
      "missing-agent-open-door",
      registry,
      "interact.openDoor",
      {}
    ),
    /not found/i
  );

  assert.deepEqual(
    getCommandInvocationHistoryForDebug(registry).map((entry) => ({
      commandId: entry.commandId,
      source: entry.source,
      requester: entry.requester,
      status: entry.status,
      botId: entry.botId,
      output: entry.output
    })),
    [
      {
        commandId: "interact.openDoor",
        source: "agent",
        requester: "agent",
        status: "failed",
        botId: "missing-agent-open-door",
        output: undefined
      },
      {
        commandId: "interact.openDoor",
        source: "agent",
        requester: "agent",
        status: "executed",
        botId,
        output: {
          botId,
          action: "openDoor",
          result: { ok: true, detail: "toggled door reach=NaN radius=NaN" }
        }
      },
      {
        commandId: "interact.openDoor",
        source: "agent",
        requester: "agent",
        status: "executed",
        botId,
        output: {
          botId,
          action: "openDoor",
          result: { ok: true, detail: "toggled door reach=4.5 radius=6" }
        }
      },
      {
        commandId: "interact.openDoor",
        source: "agent",
        requester: "agent",
        status: "executed",
        botId,
        output: {
          botId,
          action: "openDoor",
          result: { ok: true, detail: "toggled door reach=5.5 radius=7" }
        }
      }
    ]
  );
});

test("MCP interact.openDoor preserves success text and tool-level failures", async () => {
  const botId = "mcp-open-door";
  const { registry, adapter } = createRegistry(botId);
  const server = new McpServer({ name: "open-door-command-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const handler = internals._registeredTools["interact.openDoor"]?.handler;
    assert.ok(handler);

    const success = await handler({ botId, reach: 4.5, radius: 6 }, {} as never);
    assert.equal(success.isError, undefined);
    assert.equal(success.content[0]?.text, "toggled door reach=4.5 radius=6");
    assert.deepEqual(adapter.calls, [{ reach: 4.5, radius: 6 }]);

    const failure = await handler(
      { botId: "missing-mcp-open-door", reach: 4.5, radius: 6 },
      {} as never
    );
    assert.equal(failure.isError, true);
    assert.match(failure.content[0]?.text ?? "", /not found/i);

    assert.deepEqual(
      getCommandInvocationHistoryForDebug(registry).map((entry) => ({
        commandId: entry.commandId,
        source: entry.source,
        status: entry.status,
        botId: entry.botId
      })),
      [
        {
          commandId: "interact.openDoor",
          source: "mcp",
          status: "failed",
          botId: "missing-mcp-open-door"
        },
        {
          commandId: "interact.openDoor",
          source: "mcp",
          status: "executed",
          botId
        }
      ]
    );
  } finally {
    await stopActionRuntime();
    await server.close();
  }
});

test("Web open-door preserves omitted parameters, response body, and command history", async () => {
  const envNames = [
    "MCBOT_DEBUG_WEB_ENABLED",
    "MCBOT_DEBUG_WEB_HOST",
    "MCBOT_DEBUG_WEB_PORT",
    "MCBOT_DEBUG_WEB_AUTH_TOKEN"
  ];
  const previousEnv = new Map<string, string | undefined>(
    envNames.map((name) => [name, process.env[name]])
  );
  const botId = "web-open-door";
  const { registry, adapter } = createRegistry(botId);
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

    const success = await request(port, "/api/action/open-door", {
      method: "POST",
      body: JSON.stringify({ botId })
    });
    assert.equal(success.statusCode, 200);
    assert.deepEqual(JSON.parse(success.body), {
      botId,
      action: "openDoor",
      result: { ok: true, detail: "toggled door reach=undefined radius=undefined" }
    });
    assert.deepEqual(adapter.calls, [{ reach: undefined, radius: undefined }]);

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
      [{ commandId: "interact.openDoor", source: "web", status: "executed" }]
    );
    assert.equal(payload.actionHistory?.[0]?.action, "open-door");
    assert.equal(payload.actionHistory?.[0]?.ok, true);

    const failure = await request(port, "/api/action/open-door", {
      method: "POST",
      body: JSON.stringify({ botId: "missing-web-open-door" })
    });
    assert.equal(failure.statusCode, 500);
    assert.match(failure.body, /not found/i);

    assert.deepEqual(
      getCommandInvocationHistoryForDebug(registry).map((entry) => ({
        commandId: entry.commandId,
        source: entry.source,
        status: entry.status,
        botId: entry.botId
      })),
      [
        {
          commandId: "interact.openDoor",
          source: "web",
          status: "failed",
          botId: "missing-web-open-door"
        },
        {
          commandId: "interact.openDoor",
          source: "web",
          status: "executed",
          botId
        }
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
