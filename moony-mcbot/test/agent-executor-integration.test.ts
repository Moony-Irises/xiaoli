import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import {
  getAgentStatusForDebug,
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

function createBotInput(botId: string): BotCreateInput {
  return {
    botId,
    authApiBaseUrl: "http://127.0.0.1:3000",
    username: "agent-executor-test-user",
    password: "not-used",
    serverHost: "127.0.0.1",
    autoReconnect: false
  };
}

function createRegistry(botId: string): BotRegistry {
  const adapter = new FakeClientAdapter("modded-client");
  const registry = new BotRegistry({
    clientAdapterKind: "modded-client",
    clientAdapterFactory: {
      create: () => adapter
    }
  });
  const runtime = registry.create(createBotInput(botId));
  (runtime as unknown as RuntimeStateInternals).state = "spawned";
  adapter.setRuntimeState("spawned");
  return registry;
}

function readExecutorAttached(response: McpToolResponse): boolean | undefined {
  const payload = JSON.parse(response.content[0]?.text ?? "{}") as {
    executorAttached?: boolean;
  };
  return payload.executorAttached;
}

test("agent configure and shutdown project executor lifecycle attachment", async () => {
  const botId = "agent-executor-integration";
  const registry = createRegistry(botId);
  const server = new McpServer({ name: "agent-executor-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const configure = internals._registeredTools["agent.configure"]?.handler;
    const status = internals._registeredTools["agent.status"]?.handler;
    assert.ok(configure);
    assert.ok(status);

    const autoResponse = await configure(
      { botId, enabled: true, mode: "auto", planCooldownMs: 60000 },
      {} as never
    );
    assert.equal(autoResponse.isError, undefined);
    assert.equal(readExecutorAttached(autoResponse), true);
    assert.equal(getAgentStatusForDebug(botId).executorAttached, true);

    const manualResponse = await configure({ botId, mode: "manual" }, {} as never);
    assert.equal(manualResponse.isError, undefined);
    assert.equal(readExecutorAttached(manualResponse), false);
    assert.equal(getAgentStatusForDebug(botId).executorAttached, false);

    const restartedResponse = await configure({ botId, mode: "auto" }, {} as never);
    assert.equal(restartedResponse.isError, undefined);
    assert.equal(readExecutorAttached(restartedResponse), true);

    const statusResponse = await status({ botId }, {} as never);
    assert.equal(statusResponse.isError, undefined);
    assert.equal(readExecutorAttached(statusResponse), true);

    stopActionRuntime();
    assert.equal(getAgentStatusForDebug(botId).executorAttached, false);
  } finally {
    stopActionRuntime();
    await server.close();
  }
});
