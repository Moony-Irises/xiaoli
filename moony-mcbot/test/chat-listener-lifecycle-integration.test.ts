import assert from "node:assert/strict";
import test from "node:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type {
  ClientChatEventHandler,
  SelfStateSnapshot
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

class ChatListenerClientAdapter extends FakeClientAdapter {
  private readonly subscriptions = new Set<ClientChatEventHandler>();
  subscribeCount = 0;
  unsubscribeCount = 0;

  override getSelfState(): SelfStateSnapshot {
    return {
      username: "XiaoLi",
      position: { x: 0, y: 64, z: 0 }
    };
  }

  override subscribeChatEvents(handler: ClientChatEventHandler): () => void {
    this.subscribeCount += 1;
    this.subscriptions.add(handler);
    let active = true;

    return () => {
      if (!active) return;
      active = false;
      this.unsubscribeCount += 1;
      this.subscriptions.delete(handler);
    };
  }

  get activeSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

function createBotInput(botId: string): BotCreateInput {
  return {
    botId,
    authApiBaseUrl: "http://127.0.0.1:3000",
    username: "chat-listener-test-user",
    password: "not-used",
    serverHost: "127.0.0.1",
    autoReconnect: false
  };
}

function createRegistry(botId: string): {
  registry: BotRegistry;
  adapter: ChatListenerClientAdapter;
} {
  const adapter = new ChatListenerClientAdapter("modded-client");
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

function parsePayload(response: McpToolResponse): Record<string, unknown> {
  return JSON.parse(response.content[0]?.text ?? "{}") as Record<string, unknown>;
}

test("chat listener tools attach once and unsubscribe when disabled", async () => {
  const botId = "chat-listener-lifecycle-integration";
  const { registry, adapter } = createRegistry(botId);
  const server = new McpServer({ name: "chat-listener-test", version: "1.0.0" });

  try {
    await registerActionTools(server, registry);
    const internals = server as unknown as McpServerInternals;
    const configure = internals._registeredTools["chat.listener.configure"]?.handler;
    const status = internals._registeredTools["chat.listener.status"]?.handler;
    assert.ok(configure);
    assert.ok(status);

    const enabled = await configure(
      { botId, enabled: true, whitelist: ["Judy"], wakeNames: ["小狸"] },
      {} as never
    );
    assert.equal(enabled.isError, undefined);
    assert.equal(adapter.subscribeCount, 1);
    assert.equal(adapter.activeSubscriptionCount, 1);

    const enabledStatus = await status({ botId }, {} as never);
    assert.equal(enabledStatus.isError, undefined);
    assert.equal(parsePayload(enabledStatus).attached, true);

    const enabledAgain = await configure({ botId, enabled: true }, {} as never);
    assert.equal(enabledAgain.isError, undefined);
    assert.equal(adapter.subscribeCount, 1);
    assert.equal(adapter.activeSubscriptionCount, 1);

    const disabled = await configure({ botId, enabled: false }, {} as never);
    assert.equal(disabled.isError, undefined);
    assert.equal(adapter.unsubscribeCount, 1);
    assert.equal(adapter.activeSubscriptionCount, 0);

    const disabledStatus = await status({ botId }, {} as never);
    assert.equal(disabledStatus.isError, undefined);
    assert.equal(parsePayload(disabledStatus).attached, false);
  } finally {
    stopActionRuntime();
    await server.close();
  }
});
