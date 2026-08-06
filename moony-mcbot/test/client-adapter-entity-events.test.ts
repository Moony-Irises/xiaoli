import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { McClientService } from "../src/services/mc-client-service.js";
import { ClientEntityEvent } from "../src/runtime/client-adapter.js";
import { createClientAdapter } from "../src/runtime/client-adapter-factory.js";

interface AdapterInternals {
  bot: EventEmitter | null;
}

test("Mineflayer adapter normalizes entity lifecycle events and supports idempotent unsubscribe", () => {
  const adapter = createClientAdapter("mineflayer", {
    mcClientService: new McClientService()
  });
  const nativeBot = new EventEmitter();
  (adapter as unknown as AdapterInternals).bot = nativeBot;
  const events: ClientEntityEvent[] = [];

  const unsubscribe = adapter.subscribeEntityEvents((event) => {
    events.push(event);
  });
  nativeBot.emit("entityDead", {
    id: 42,
    name: "zombie",
    displayName: "Zombie",
    type: "mob",
    kind: "Hostile mobs",
    position: { x: 1, y: 64, z: 2 }
  });
  nativeBot.emit("death");

  assert.deepEqual(events, [
    {
      type: "entity_dead",
      entity: {
        entityId: 42,
        name: "zombie",
        displayName: "Zombie",
        type: "mob",
        kind: "Hostile mobs",
        position: { x: 1, y: 64, z: 2 }
      }
    },
    { type: "self_death" }
  ]);

  unsubscribe();
  unsubscribe();
  nativeBot.emit("death");
  assert.equal(events.length, 2);
});

test("Mineflayer adapter clears entity subscriptions with the native bot reference", () => {
  const adapter = createClientAdapter("mineflayer", {
    mcClientService: new McClientService()
  });
  const nativeBot = new EventEmitter();
  (adapter as unknown as AdapterInternals).bot = nativeBot;
  const events: ClientEntityEvent[] = [];
  adapter.subscribeEntityEvents((event) => {
    events.push(event);
  });

  adapter.clearBotReference();
  nativeBot.emit("entityDead", { id: 7, name: "creeper", type: "mob" });
  nativeBot.emit("death");

  assert.deepEqual(events, []);
  assert.equal(nativeBot.listenerCount("entityDead"), 0);
  assert.equal(nativeBot.listenerCount("death"), 0);
});
