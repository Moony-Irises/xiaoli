import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { startDebugWebServer } from "../src/debug/debug-server.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type {
  ActionResult,
  ClientCapability,
  HoldItemByCategoryInput
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
      args: HoldItemByCategoryInput & { botId: string },
      extra: never
    ) => McpToolResponse | Promise<McpToolResponse>;
  }>;
}

interface RuntimeStateInternals {
  state: RuntimeState;
}

class HoldCategoryClientAdapter extends FakeClientAdapter {
  readonly calls: HoldItemByCategoryInput[] = [];

  override supportsCapability(capability: ClientCapability): boolean {
    return capability === "hold_item_by_category";
  }

  override async holdItemByCategory(input: HoldItemByCategoryInput): Promise<ActionResult> {
    this.calls.push({ ...input });
    return { ok: true, detail: `equipped '${input.category}_item' for ${input.category}` };
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

function createRegistry(
  botId: string
): { registry: BotRegistry; adapter: HoldCategoryClientAdapter } {
  const adapter = new HoldCategoryClientAdapter("modded-client");
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

test("Agent inventory.holdByCategory preserves trim, text, and boundary errors", async () => {
  const botId = "agent-hold-category";
  const { registry, adapter } = createRegistry(botId);

  assert.equal(
    await executeAgentToolCall(
      botId,
      registry,
      "inventory.holdByCategory",
      { category: " sword " }
    ),
    "equipped 'sword_item' for sword"
  );
  assert.deepEqual(adapter.calls, [{ category: "sword" }]);

  await assert.rejects(
    executeAgentToolCall(
      botId,
      registry,
      "inventory.holdByCategory",
      { category: "hoe" }
    ),
    /Unsupported inventory category 'hoe'/
  );
  await assert.rejects(
    executeAgentToolCall(
      "missing-agent-hold-category",
      registry,
      "inventory.holdByCategory",
      { category: "pickaxe" }
    ),
    /not found/i
  );
  assert.deepEqual(adapter.calls, [{ category: "sword" }]);

  const history = getCommandInvocationHistoryForDebug(registry);
  assert.deepEqual(
    history.map((entry) => ({
      commandId: entry.commandId,
      source: entry.source,
      requester: entry.requester,
      status: entry.status,
      botId: entry.botId,
      output: entry.output
    })),
    [
      {
        commandId: "inventory.holdByCategory",
        source: "agent",
        requester: "agent",
        status: "failed",
        botId: "missing-agent-hold-category",
        output: undefined
      },
      {
        commandId: "inventory.holdByCategory",
        source: "agent",
        requester: "agent",
        status: "executed",
        botId,
        output: {
          action: "hold-category",
          result: { ok: true, detail: "equipped 'sword_item' for sword" }
        }
      }
    ]
  );
});

test("MCP inventory.holdByCategory preserves tool-level success and failure responses", async () => {
  const botId = "mcp-hold-category";
  const { registry, adapter } = createRegistry(botId);
  const server = new McpServer({ name: "hold-category-command-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const handler = internals._registeredTools["inventory.holdByCategory"]?.handler;
    assert.ok(handler);

    const success = await handler({ botId, category: "food" }, {} as never);
    assert.equal(success.isError, undefined);
    assert.equal(success.content[0]?.text, "Equipped 'food_item' for food");
    assert.deepEqual(adapter.calls, [{ category: "food" }]);

    const failure = await handler(
      { botId: "missing-mcp-hold-category", category: "axe" },
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
          commandId: "inventory.holdByCategory",
          source: "mcp",
          status: "failed",
          botId: "missing-mcp-hold-category"
        },
        {
          commandId: "inventory.holdByCategory",
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

test("Web hold-category preserves its endpoint and records only validated commands", async () => {
  const envNames = [
    "MCBOT_DEBUG_WEB_ENABLED",
    "MCBOT_DEBUG_WEB_HOST",
    "MCBOT_DEBUG_WEB_PORT",
    "MCBOT_DEBUG_WEB_AUTH_TOKEN"
  ];
  const previousEnv = new Map<string, string | undefined>(
    envNames.map((name) => [name, process.env[name]])
  );
  const botId = "web-hold-category";
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

    const success = await request(port, "/api/action/hold-category", {
      method: "POST",
      body: JSON.stringify({ botId, category: " sword " })
    });
    assert.equal(success.statusCode, 200);
    assert.deepEqual(JSON.parse(success.body), {
      action: "hold-category",
      result: { ok: true, detail: "equipped 'sword_item' for sword" }
    });
    assert.deepEqual(adapter.calls, [{ category: "sword" }]);

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
      [{ commandId: "inventory.holdByCategory", source: "web", status: "executed" }]
    );
    assert.equal(payload.actionHistory?.[0]?.action, "hold-category");
    assert.equal(payload.actionHistory?.[0]?.ok, true);

    const invalid = await request(port, "/api/action/hold-category", {
      method: "POST",
      body: JSON.stringify({ botId, category: "hoe" })
    });
    assert.equal(invalid.statusCode, 500);
    assert.match(invalid.body, /category must be one of: sword, axe, pickaxe, food/);

    const failure = await request(port, "/api/action/hold-category", {
      method: "POST",
      body: JSON.stringify({ botId: "missing-web-hold-category", category: "pickaxe" })
    });
    assert.equal(failure.statusCode, 500);
    assert.match(failure.body, /not found/i);
    assert.deepEqual(adapter.calls, [{ category: "sword" }]);

    assert.deepEqual(
      getCommandInvocationHistoryForDebug(registry).map((entry) => ({
        commandId: entry.commandId,
        source: entry.source,
        status: entry.status,
        botId: entry.botId
      })),
      [
        {
          commandId: "inventory.holdByCategory",
          source: "web",
          status: "failed",
          botId: "missing-web-hold-category"
        },
        {
          commandId: "inventory.holdByCategory",
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
