import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type {
  ActionResult,
  ClientCapability,
  WalkForwardInput
} from "../src/runtime/client-adapter.js";
import {
  registerActionTools,
  stopActionRuntime
} from "../src/tools/action-tools.js";
import type { BotCreateInput, RuntimeState } from "../src/types.js";
import { FakeClientAdapter } from "./helpers/fake-client-adapter.js";

interface McpToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}

interface McpServerInternals {
  _registeredTools: Record<string, {
    handler: (
      args: Record<string, unknown>,
      extra: never
    ) => McpToolResponse | Promise<McpToolResponse>;
  }>;
}

interface RuntimeStateInternals {
  state: RuntimeState;
}

class WalkClientAdapter extends FakeClientAdapter {
  readonly calls: string[] = [];

  override supportsCapability(capability: ClientCapability): boolean {
    return capability === "walk_forward" ||
      capability === "stop_movement" ||
      capability === "stop_follow";
  }

  override async walkForward(input: WalkForwardInput = {}): Promise<ActionResult> {
    this.calls.push(`walk:${input.sprint ?? false}:${input.jump ?? false}`);
    return { ok: true, detail: "walking" };
  }

  override async stopMovement(): Promise<ActionResult> {
    this.calls.push("stop");
    return { ok: true, detail: "stopped" };
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

function createRegistry(botId: string): { registry: BotRegistry; adapter: WalkClientAdapter } {
  const adapter = new WalkClientAdapter("modded-client");
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

test("MCP movement.walk stops movement after the requested duration", async () => {
  const botId = "mcp-walk-elapsed";
  const { registry, adapter } = createRegistry(botId);
  const server = new McpServer({ name: "walk-command-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const handler = internals._registeredTools["movement.walk"]?.handler;
    assert.ok(handler);

    const response = await handler(
      { botId, durationMs: 100, sprint: false, jump: true },
      {} as never
    );

    assert.equal(response.isError, undefined);
    assert.equal(response.content[0]?.text, "Walking forward for 100ms (sprint=false, jump=true)");
    assert.deepEqual(adapter.calls, ["stop", "stop", "walk:false:true"]);

    await new Promise((resolve) => setTimeout(resolve, 130));
    assert.deepEqual(adapter.calls, ["stop", "stop", "walk:false:true", "stop"]);
  } finally {
    stopActionRuntime();
    await server.close();
  }
});

test("MCP movement.stop cancels the pending walk timer", async () => {
  const botId = "mcp-walk-cancelled";
  const { registry, adapter } = createRegistry(botId);
  const server = new McpServer({ name: "walk-stop-command-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const walkHandler = internals._registeredTools["movement.walk"]?.handler;
    const stopHandler = internals._registeredTools["movement.stop"]?.handler;
    assert.ok(walkHandler);
    assert.ok(stopHandler);

    await walkHandler(
      { botId, durationMs: 100, sprint: true, jump: false },
      {} as never
    );
    const response = await stopHandler({ botId }, {} as never);

    assert.equal(response.isError, undefined);
    assert.equal(response.content[0]?.text, "Stopped movement");
    assert.deepEqual(adapter.calls, ["stop", "stop", "walk:true:false", "stop", "stop"]);

    await new Promise((resolve) => setTimeout(resolve, 130));
    assert.deepEqual(adapter.calls, ["stop", "stop", "walk:true:false", "stop", "stop"]);
  } finally {
    stopActionRuntime();
    await server.close();
  }
});

test("action runtime shutdown cancels the pending MCP walk timer", async () => {
  const botId = "mcp-walk-shutdown";
  const { registry, adapter } = createRegistry(botId);
  const server = new McpServer({ name: "walk-shutdown-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const walkHandler = internals._registeredTools["movement.walk"]?.handler;
    assert.ok(walkHandler);

    await walkHandler(
      { botId, durationMs: 100, sprint: false, jump: false },
      {} as never
    );
    assert.deepEqual(adapter.calls, ["stop", "stop", "walk:false:false"]);

    stopActionRuntime();
    await new Promise((resolve) => setTimeout(resolve, 130));
    assert.deepEqual(adapter.calls, ["stop", "stop", "walk:false:false"]);
  } finally {
    stopActionRuntime();
    await server.close();
  }
});
