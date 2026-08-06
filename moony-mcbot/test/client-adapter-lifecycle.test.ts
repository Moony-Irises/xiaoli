import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createClientAdapter } from "../src/runtime/client-adapter-factory.js";
import { McClientService } from "../src/services/mc-client-service.js";

interface AdapterInternals {
  bot: EventEmitter | null;
}

test("Mineflayer adapter disconnect is idempotent and waits for service cleanup", async () => {
  const service = new McClientService();
  const adapter = createClientAdapter("mineflayer", { mcClientService: service });
  const nativeBot = new EventEmitter();
  (adapter as unknown as AdapterInternals).bot = nativeBot;
  adapter.setRuntimeState("spawned");
  adapter.subscribeChatEvents(() => {});
  adapter.subscribeEntityEvents(() => {});
  adapter.subscribeMovementEvents(() => {});
  let disconnectCalls = 0;
  let releaseDisconnect: (() => void) | undefined;
  const disconnectGate = new Promise<void>((resolve) => {
    releaseDisconnect = resolve;
  });
  service.disconnect = () => {
    disconnectCalls += 1;
    return disconnectGate;
  };

  const first = adapter.disconnect("adapter test");
  const second = adapter.disconnect("duplicate adapter test");

  assert.equal(first, second);
  assert.equal(disconnectCalls, 1);
  assert.equal(adapter.getConnectionState().connected, false);
  assert.equal(nativeBot.listenerCount("chat"), 0);
  assert.equal(nativeBot.listenerCount("messagestr"), 0);
  assert.equal(nativeBot.listenerCount("entityDead"), 0);
  assert.equal(nativeBot.listenerCount("death"), 0);
  assert.notEqual((adapter as unknown as AdapterInternals).bot, null);

  releaseDisconnect?.();
  await first;
  assert.equal((adapter as unknown as AdapterInternals).bot, null);
  assert.equal(adapter.getConnectionState().runtimeState, "disconnected");
});

test("Mineflayer adapter releases its bot reference when disconnect fails", async () => {
  const service = new McClientService();
  const adapter = createClientAdapter("mineflayer", { mcClientService: service });
  const nativeBot = new EventEmitter();
  (adapter as unknown as AdapterInternals).bot = nativeBot;
  adapter.setRuntimeState("spawned");
  adapter.subscribeChatEvents(() => {});
  service.disconnect = () => {
    throw new Error("service disconnect failed");
  };

  await assert.rejects(adapter.disconnect("failure test"), /service disconnect failed/);
  assert.equal((adapter as unknown as AdapterInternals).bot, null);
  assert.equal(adapter.getConnectionState().runtimeState, "disconnected");
  assert.equal(nativeBot.listenerCount("chat"), 0);
  assert.equal(nativeBot.listenerCount("messagestr"), 0);
});

test("Mineflayer adapter disconnect accepts an absent bot", async () => {
  const adapter = createClientAdapter("mineflayer", {
    mcClientService: new McClientService()
  });

  await adapter.disconnect("already offline");

  assert.deepEqual(adapter.getConnectionState(), {
    kind: "mineflayer",
    runtimeState: "disconnected",
    connected: false
  });
});
