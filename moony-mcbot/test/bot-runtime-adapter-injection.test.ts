import assert from "node:assert/strict";
import test from "node:test";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import { BotRuntime } from "../src/runtime/bot-runtime.js";
import { ClientAdapterKind } from "../src/runtime/client-adapter.js";
import { BotCreateInput } from "../src/types.js";
import { FakeClientAdapter } from "./helpers/fake-client-adapter.js";

function createInput(botId: string): BotCreateInput {
  return {
    botId,
    authApiBaseUrl: "http://127.0.0.1:3000",
    username: "adapter-test-user",
    password: "not-used",
    serverHost: "127.0.0.1",
    autoReconnect: false
  };
}

test("BotRuntime keeps Mineflayer as the default adapter", () => {
  const runtime = new BotRuntime("default-adapter", createInput("default-adapter"));

  assert.equal(runtime.getClientAdapterKind(), "mineflayer");
});

test("BotRuntime requests the injected adapter kind from the injected factory", () => {
  const requestedKinds: ClientAdapterKind[] = [];
  const adapter = new FakeClientAdapter("modded-client");
  const runtime = new BotRuntime("custom-adapter", createInput("custom-adapter"), {
    clientAdapterKind: "modded-client",
    clientAdapterFactory: {
      create(kind) {
        requestedKinds.push(kind);
        return adapter;
      }
    }
  });

  assert.deepEqual(requestedKinds, ["modded-client"]);
  assert.equal(runtime.getClientAdapterKind(), "modded-client");
  assert.equal(runtime.getClientAdapterStatus().connection.kind, "modded-client");
});

test("BotRuntime rejects a factory result whose kind does not match the request", () => {
  assert.throws(
    () =>
      new BotRuntime("mismatched-adapter", createInput("mismatched-adapter"), {
        clientAdapterKind: "modded-client",
        clientAdapterFactory: {
          create: () => new FakeClientAdapter("mineflayer")
        }
      }),
    /requested.*modded-client.*returned.*mineflayer/i
  );
});

test("BotRegistry forwards adapter composition dependencies to each runtime", () => {
  const requestedKinds: ClientAdapterKind[] = [];
  const registry = new BotRegistry({
    clientAdapterKind: "modded-client",
    clientAdapterFactory: {
      create(kind) {
        requestedKinds.push(kind);
        return new FakeClientAdapter(kind);
      }
    }
  });

  const first = registry.create(createInput("registry-adapter-1"));
  const second = registry.create(createInput("registry-adapter-2"));

  assert.deepEqual(requestedKinds, ["modded-client", "modded-client"]);
  assert.equal(first.getClientAdapterKind(), "modded-client");
  assert.equal(second.getClientAdapterKind(), "modded-client");
});

test("BotRegistry does not retain a bot when adapter construction fails", () => {
  const registry = new BotRegistry({
    clientAdapterKind: "modded-client",
    clientAdapterFactory: {
      create() {
        throw new Error("bridge unavailable");
      }
    }
  });

  assert.throws(
    () => registry.create(createInput("failed-adapter")),
    /bridge unavailable/
  );
  assert.deepEqual(registry.listBotIds(), []);
});
