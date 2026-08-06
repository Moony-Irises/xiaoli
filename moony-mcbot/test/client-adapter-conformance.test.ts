import assert from "node:assert/strict";
import test from "node:test";
import { McClientService } from "../src/services/mc-client-service.js";
import {
  CLIENT_CAPABILITIES,
  ClientAdapter
} from "../src/runtime/client-adapter.js";
import { createClientAdapter } from "../src/runtime/client-adapter-factory.js";

const ADAPTER_METHODS: Array<keyof ClientAdapter> = [
  "setRuntimeState",
  "clearBotReference",
  "connect",
  "awaitReady",
  "disconnect",
  "waitForChatEcho",
  "subscribeChatEvents",
  "subscribeEntityEvents",
  "subscribeMovementEvents",
  "getConnectionState",
  "supportsCapability",
  "sendChat",
  "getSelfState",
  "getPlayerSnapshot",
  "getNearbyPlayers",
  "getNearbyEntities",
  "getBlockObservation",
  "getInventoryState",
  "attackEntity",
  "attackNearestEntity",
  "attackPlayer",
  "dropHeldItem",
  "dropHotbarSlot",
  "eatFood",
  "holdHotbarSlot",
  "holdItemByCategory",
  "mineBlock",
  "organizeHotbar",
  "moveTo",
  "pursueEntity",
  "look",
  "openDoor",
  "swingArm",
  "useHeldItem",
  "walkForward",
  "stopMovement"
];

test("Mineflayer adapter conforms to the shared client capability contract offline", async () => {
  const adapter: ClientAdapter = createClientAdapter("mineflayer", {
    mcClientService: new McClientService()
  });

  assert.equal(adapter.kind, "mineflayer");
  assert.deepEqual(adapter.getConnectionState(), {
    kind: "mineflayer",
    runtimeState: "idle",
    connected: false
  });
  for (const method of ADAPTER_METHODS) {
    assert.equal(typeof adapter[method], "function", `${String(method)} must be implemented`);
  }
  for (const capability of CLIENT_CAPABILITIES) {
    assert.equal(adapter.supportsCapability(capability), true, `${capability} must be advertised`);
  }
  assert.equal(adapter.getSelfState(), null);
  assert.equal(await adapter.waitForChatEcho("bot", "message", 1), false);
  assert.equal(typeof adapter.subscribeChatEvents(() => {}), "function");
  assert.equal(typeof adapter.subscribeEntityEvents(() => {}), "function");
  const unsubscribeMovement = adapter.subscribeMovementEvents(() => {});
  assert.equal(typeof unsubscribeMovement, "function");
  unsubscribeMovement();
  unsubscribeMovement();
  assert.deepEqual(adapter.getNearbyPlayers(), []);
  assert.deepEqual(adapter.getNearbyEntities(), []);
  assert.deepEqual(adapter.getBlockObservation(), { feet: null, inSight: null });
  assert.deepEqual(adapter.getInventoryState(true).items, []);
});
