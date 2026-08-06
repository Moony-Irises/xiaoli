import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { McClientService } from "../src/services/mc-client-service.js";

type ServiceBot = Parameters<McClientService["disconnect"]>[0];
type AsyncDisconnect = (
  bot: ServiceBot,
  reason?: string,
  timeoutMs?: number
) => Promise<void>;

function createServiceBot(onQuit: (reason?: string) => void): {
  bot: ServiceBot;
  emitter: EventEmitter;
} {
  const emitter = new EventEmitter() as EventEmitter & {
    quit(reason?: string): void;
  };
  emitter.quit = onQuit;
  return {
    bot: emitter as unknown as ServiceBot,
    emitter
  };
}

test("McClientService disconnect waits for the Mineflayer end event", async () => {
  const service = new McClientService();
  const disconnect = service.disconnect.bind(service) as unknown as AsyncDisconnect;
  let quitReason: string | undefined;
  const { bot, emitter } = createServiceBot((reason) => {
    quitReason = reason;
  });

  const pending = disconnect(bot, "graceful test", 100);
  assert.equal(typeof pending?.then, "function");
  let settled = false;
  void pending.then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(quitReason, "graceful test");
  assert.equal(emitter.listenerCount("end"), 1);

  emitter.emit("end", "graceful test");
  await pending;
  assert.equal(settled, true);
  assert.equal(emitter.listenerCount("end"), 0);
});

test("McClientService disconnect removes its listener when quit throws", async () => {
  const service = new McClientService();
  const disconnect = service.disconnect.bind(service) as unknown as AsyncDisconnect;
  const { bot, emitter } = createServiceBot(() => {
    throw new Error("quit failed");
  });

  await assert.rejects(disconnect(bot, "failure test", 100), /quit failed/);
  assert.equal(emitter.listenerCount("end"), 0);
});

test("McClientService disconnect rejects a missing end event after a bounded timeout", async () => {
  const service = new McClientService();
  const disconnect = service.disconnect.bind(service) as unknown as AsyncDisconnect;
  const { bot, emitter } = createServiceBot(() => {});

  await assert.rejects(disconnect(bot, "timeout test", 5), /timeout.*5ms/i);
  assert.equal(emitter.listenerCount("end"), 0);
});
