import assert from "node:assert/strict";
import test from "node:test";
import {
  CLIENT_CAPABILITIES,
  ClientEntityEventHandler,
  ClientMovementEventHandler
} from "../src/runtime/client-adapter.js";
import { BotRuntime } from "../src/runtime/bot-runtime.js";
import { runStartupLifecycle } from "../src/runtime/startup-lifecycle.js";
import { RuntimeState } from "../src/types.js";

interface RuntimeTestInternals {
  state: RuntimeState;
  adapter: {
    sendChat(message: string): Promise<{ ok: boolean; detail?: string }>;
    eatFood(input?: { itemName?: string }): Promise<{ ok: boolean; detail?: string }>;
    organizeHotbar(): Promise<{
      ok: boolean;
      detail?: string;
      actions: Array<{ category: "sword"; status: "moved"; item: string; fromSlot: number; toHotbar: number }>;
    }>;
    moveTo(input: { x: number; y: number; z: number; stopRadius?: number; movementId?: string }): Promise<{ ok: boolean; detail?: string }>;
    mineBlock(input: {
      target: { name: string; position: { x: number; y: number; z: number } };
    }): Promise<{
      ok: boolean;
      outcome: "mined";
      block: { name: string; position: { x: number; y: number; z: number } };
      initialDistance: number;
      finalDistance: number;
    }>;
    subscribeEntityEvents(handler: ClientEntityEventHandler): () => void;
    subscribeMovementEvents(handler: ClientMovementEventHandler): () => void;
    attackEntity(input: { entityId: number; maxDistance?: number }): Promise<{ ok: boolean; detail?: string }>;
    pursueEntity(input: { entityId: number; stopDistance?: number; sprint?: boolean; jump?: boolean; movementId?: string }): Promise<{ ok: boolean; detail?: string }>;
  };
}

function createOfflineRuntime(): BotRuntime {
  return new BotRuntime("adapter-status-test", {
    botId: "adapter-status-test",
    authApiBaseUrl: "http://127.0.0.1:3000",
    username: "test-user",
    password: "not-used",
    serverHost: "127.0.0.1"
  });
}

function requireAssignedHandler<T>(handler: T | null, label: string): T {
  if (handler === null) throw new Error(`${label} was not assigned`);
  return handler;
}

test("client adapter status reports every declared Mineflayer capability before connecting", () => {
  const runtime = createOfflineRuntime();

  const status = runtime.getClientAdapterStatus();

  assert.equal(status.kind, "mineflayer");
  assert.equal(status.connection.kind, "mineflayer");
  assert.equal(status.connection.runtimeState, "idle");
  assert.equal(status.connection.connected, false);
  assert.deepEqual(Object.keys(status.capabilities).sort(), [...CLIENT_CAPABILITIES].sort());
  assert.ok(Object.values(status.capabilities).every((supported) => supported));
  assert.deepEqual(status.recentActions, []);
  assert.deepEqual(runtime.getInventoryState(true), {
    heldItem: null,
    armor: {
      head: null,
      torso: null,
      legs: null,
      feet: null
    },
    items: [],
    slots: []
  });
});

test("client adapter action history redacts chat, records errors, and keeps only 24 entries", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  internals.state = "spawned";
  internals.adapter.sendChat = async () => ({
    ok: true,
    detail: "sent chat: private test content"
  });
  internals.adapter.eatFood = async () => {
    throw new Error("food unavailable");
  };

  await runtime.sendChat("private test content");
  await assert.rejects(runtime.eatFood(), /food unavailable/);
  const failureStatus = runtime.getClientAdapterStatus();
  assert.equal(failureStatus.recentActions[0]?.action, "eat_food");
  assert.equal(failureStatus.recentActions[0]?.ok, false);
  assert.equal(failureStatus.recentActions[0]?.error, "food unavailable");
  for (let index = 0; index < 24; index += 1) {
    await runtime.sendChat(`message ${index}`);
  }

  const status = runtime.getClientAdapterStatus();
  assert.equal(status.recentActions.length, 24);
  assert.equal(status.recentActions[0]?.action, "send_chat");
  assert.equal(status.recentActions[0]?.detail, "chat sent");
  assert.ok(status.recentActions.every((entry) => entry.detail !== "sent chat: private test content"));
  assert.ok(status.recentActions.every((entry) => entry.error !== "food unavailable"));
  assert.ok(status.recentActions.every((entry) => /^\d{4}-\d{2}-\d{2}T/.test(entry.timestamp)));
});

test("organizeHotbar preserves structured actions and records adapter evidence", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  internals.state = "spawned";
  internals.adapter.organizeHotbar = async () => ({
    ok: true,
    detail: "organized hotbar with 1 slot moves (0 blocked)",
    actions: [{
      category: "sword",
      status: "moved",
      item: "iron_sword",
      fromSlot: 10,
      toHotbar: 1
    }]
  });

  const result = await runtime.organizeHotbar();

  assert.equal(result.actions[0]?.item, "iron_sword");
  assert.deepEqual(runtime.getClientAdapterStatus().recentActions[0], {
    action: "organize_hotbar",
    timestamp: runtime.getClientAdapterStatus().recentActions[0]?.timestamp,
    ok: true,
    detail: "organized hotbar with 1 slot moves (0 blocked)"
  });
});

test("BotRuntime forwards entity event subscriptions only while spawned", () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  let adapterHandler: ClientEntityEventHandler | null = null;
  let unsubscribeCount = 0;
  internals.adapter.subscribeEntityEvents = (handler) => {
    adapterHandler = handler;
    return () => {
      unsubscribeCount += 1;
    };
  };

  const offlineUnsubscribe = runtime.subscribeEntityEvents(() => {
    throw new Error("offline handler must not be registered");
  });
  offlineUnsubscribe();
  assert.equal(adapterHandler, null);

  internals.state = "spawned";
  const received: string[] = [];
  const unsubscribe = runtime.subscribeEntityEvents((event) => {
    received.push(event.type);
  });
  assert.notEqual(adapterHandler, null);
  const emitEntityEvent = requireAssignedHandler<ClientEntityEventHandler>(
    adapterHandler,
    "entity event handler"
  );
  emitEntityEvent({ type: "self_death" });
  unsubscribe();

  assert.deepEqual(received, ["self_death"]);
  assert.equal(unsubscribeCount, 1);
});

test("BotRuntime shares one movement event bridge and records asynchronous failure once", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  let adapterHandler: ClientMovementEventHandler | null = null;
  let adapterSubscribeCount = 0;
  let adapterUnsubscribeCount = 0;
  internals.adapter.subscribeMovementEvents = (handler) => {
    adapterSubscribeCount += 1;
    adapterHandler = handler;
    return () => {
      adapterUnsubscribeCount += 1;
      adapterHandler = null;
    };
  };

  const offlineUnsubscribe = runtime.subscribeMovementEvents(() => {
    throw new Error("offline handler must not be registered");
  });
  offlineUnsubscribe();
  assert.equal(adapterSubscribeCount, 0);

  internals.state = "spawned";
  const received: string[] = [];
  const unsubscribeThrowing = runtime.subscribeMovementEvents(() => {
    throw new Error("observer failed");
  });
  const unsubscribeReceiving = runtime.subscribeMovementEvents((event) => {
    received.push(event.movementId);
  });
  assert.equal(adapterSubscribeCount, 1);

  const emitMovementEvent = requireAssignedHandler<ClientMovementEventHandler>(
    adapterHandler,
    "movement event handler"
  );
  emitMovementEvent({
    type: "movement_failed",
    movementId: "follow:42:1",
    action: "pursue_entity",
    reason: "no_path",
    detail: "safe path no_path: continuous route is unavailable or unsafe"
  });

  assert.deepEqual(received, ["follow:42:1"]);
  assert.deepEqual(runtime.getClientAdapterStatus().recentActions, [{
    action: "pursue_entity",
    timestamp: runtime.getClientAdapterStatus().recentActions[0]?.timestamp,
    ok: false,
    error: "safe path no_path: continuous route is unavailable or unsafe"
  }]);

  unsubscribeThrowing();
  assert.equal(adapterUnsubscribeCount, 0);
  unsubscribeReceiving();
  unsubscribeReceiving();
  assert.equal(adapterUnsubscribeCount, 0);
  assert.notEqual(adapterHandler, null);

  await runtime.disconnect("test cleanup");
  assert.equal(adapterUnsubscribeCount, 1);
  assert.equal(adapterHandler, null);
});

test("entity pursuit and attack actions are recorded by BotRuntime", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  internals.state = "spawned";
  internals.adapter.pursueEntity = async ({ entityId }) => ({
    ok: true,
    detail: `pursuing ${entityId}`
  });
  internals.adapter.attackEntity = async ({ entityId }) => ({
    ok: true,
    detail: `attacked ${entityId}`
  });

  await runtime.pursueEntity({ entityId: 42, stopDistance: 2 });
  await runtime.attackEntity({ entityId: 42, maxDistance: 4.5 });

  const actions = runtime.getClientAdapterStatus().recentActions;
  assert.deepEqual(actions.map((entry) => entry.action), ["attack_entity", "pursue_entity"]);
  assert.ok(actions.every((entry) => entry.ok));
});

test("fixed-position movement is recorded by BotRuntime", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  internals.state = "spawned";
  internals.adapter.moveTo = async ({ x, y, z }) => ({
    ok: true,
    detail: `moving to ${x},${y},${z}`
  });

  await runtime.moveTo({ x: 7, y: 65, z: 0, stopRadius: 2.3 });

  assert.deepEqual(runtime.getClientAdapterStatus().recentActions.map((entry) => entry.action), [
    "move_to_position"
  ]);
});

test("safe movement rejection is recorded as failed adapter evidence", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  internals.state = "spawned";
  internals.adapter.moveTo = async () => {
    throw new Error("safe pathfinder is unavailable for fixed-position movement");
  };

  await assert.rejects(
    runtime.moveTo({ x: 7, y: 65, z: 0, stopRadius: 2.3 }),
    /safe pathfinder is unavailable/
  );

  assert.deepEqual(runtime.getClientAdapterStatus().recentActions[0], {
    action: "move_to_position",
    timestamp: runtime.getClientAdapterStatus().recentActions[0]?.timestamp,
    ok: false,
    error: "safe pathfinder is unavailable for fixed-position movement"
  });
});

test("single-block mining is recorded by BotRuntime", async () => {
  const runtime = createOfflineRuntime();
  const internals = runtime as unknown as RuntimeTestInternals;
  internals.state = "spawned";
  internals.adapter.mineBlock = async ({ target }) => ({
    ok: true,
    outcome: "mined",
    block: target,
    initialDistance: 2,
    finalDistance: 2
  });

  await runtime.mineBlock({ target: { name: "coal_ore", position: { x: 2, y: 64, z: 0 } } });

  assert.deepEqual(runtime.getClientAdapterStatus().recentActions.map((entry) => entry.action), ["mine_block"]);
});

test("startup lifecycle loads persisted state before applying environment and reconciling runtime", async () => {
  const order: string[] = [];

  await runStartupLifecycle({
    loadPersistedState: async () => {
      order.push("persisted");
    },
    applyEnvironmentOverrides: () => {
      order.push("environment");
    },
    reconcileRuntime: () => {
      order.push("reconcile");
    }
  });

  assert.deepEqual(order, ["persisted", "environment", "reconcile"]);
});
