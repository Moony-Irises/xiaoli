import assert from "node:assert/strict";
import test from "node:test";
import { SelfGuardRuntimeStateStore } from "../src/runtime/self-guard-runtime-state-store.js";

test("self-guard runtime state stays isolated and returns nested copies", () => {
  const store = new SelfGuardRuntimeStateStore();
  const botRef = { username: "bot-a" };
  const reactiveFlags = {
    lowHealth: true,
    criticalHealth: false,
    lowFood: true
  };

  store.update("bot-a", {
    lastHealth: 8,
    lastIsDay: true,
    lastIsRaining: false,
    lastBotRef: botRef,
    lastIsNearPlayer: true,
    reactiveFlags
  });
  reactiveFlags.lowHealth = false;

  const first = store.get("bot-a");
  assert.deepEqual(first, {
    lastHealth: 8,
    lastIsDay: true,
    lastIsRaining: false,
    lastBotRef: botRef,
    lastIsNearPlayer: true,
    reactiveFlags: {
      lowHealth: true,
      criticalHealth: false,
      lowFood: true
    }
  });
  assert.equal(store.get("bot-b"), undefined);

  assert.ok(first?.reactiveFlags);
  first.reactiveFlags.lowFood = false;
  assert.equal(store.get("bot-a")?.reactiveFlags?.lowFood, true);
});

test("self-guard runtime state merges incremental updates", () => {
  const store = new SelfGuardRuntimeStateStore();

  store.update("bot-a", { lastAlertAt: 1000, lastHealth: 12 });
  store.update("bot-a", { lastHealth: 9, lastIsDay: false });

  assert.deepEqual(store.get("bot-a"), {
    lastAlertAt: 1000,
    lastHealth: 9,
    lastIsDay: false
  });
  store.update("bot-empty", {});
  assert.equal(store.get("bot-empty"), undefined);
});

test("resetting self-guard tick state preserves alert cooldown", () => {
  const store = new SelfGuardRuntimeStateStore();
  store.update("bot-a", {
    lastAlertAt: 1000,
    lastHealth: 9,
    lastIsDay: false,
    lastIsRaining: true,
    lastBotRef: { username: "bot-a" },
    lastIsNearPlayer: true,
    reactiveFlags: {
      lowHealth: true,
      criticalHealth: false,
      lowFood: false
    }
  });

  assert.equal(store.resetTick("bot-a"), true);
  assert.deepEqual(store.get("bot-a"), { lastAlertAt: 1000 });
  assert.equal(store.resetTick("bot-a"), false);

  store.update("bot-b", { lastHealth: 15 });
  assert.equal(store.resetTick("bot-b"), true);
  assert.equal(store.get("bot-b"), undefined);
});

test("clearing self-guard runtime state removes only the requested bot", () => {
  const store = new SelfGuardRuntimeStateStore();
  store.update("bot-a", { lastAlertAt: 1000, lastHealth: 9 });
  store.update("bot-b", { lastAlertAt: 2000, lastHealth: 15 });

  assert.equal(store.clearBot("bot-a"), true);
  assert.equal(store.clearBot("bot-a"), false);
  assert.equal(store.get("bot-a"), undefined);
  assert.deepEqual(store.get("bot-b"), { lastAlertAt: 2000, lastHealth: 15 });
});

test("self-guard runtime state rejects invalid numeric observations", () => {
  const store = new SelfGuardRuntimeStateStore();

  assert.throws(() => store.update("bot-a", { lastAlertAt: -1 }), RangeError);
  assert.throws(() => store.update("bot-a", { lastAlertAt: Number.NaN }), RangeError);
  store.update("bot-a", { lastAlertAt: 1000 });
  assert.throws(
    () =>
      store.update("bot-a", {
        lastAlertAt: 2000,
        lastHealth: Number.POSITIVE_INFINITY
      }),
    RangeError
  );
  assert.deepEqual(store.get("bot-a"), { lastAlertAt: 1000 });
});
