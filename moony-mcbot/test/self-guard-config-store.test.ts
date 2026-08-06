import assert from "node:assert/strict";
import test from "node:test";
import { SelfGuardConfigStore } from "../src/config/self-guard-config-store.js";

test("self-guard config defaults are stable and isolated between bots", () => {
  const store = new SelfGuardConfigStore();
  const first = store.getOrCreate("bot-a");
  const second = store.getOrCreate("bot-b");

  assert.deepEqual(first, {
    enabled: false,
    tickMs: 2000,
    lowFood: 10,
    lowHealth: 10,
    criticalHealth: 6,
    autoEat: true,
    autoStopFollowOnLowHealth: true,
    retaliateOnNonWhitelistHit: true,
    retaliationMaxDistance: 4.5,
    retaliationDecayMs: 60_000,
    chatAlerts: true,
    alertCooldownMs: 15_000
  });
  assert.notStrictEqual(first, second);

  first.enabled = true;
  first.tickMs = 9999;
  assert.equal(second.enabled, false);
  assert.equal(second.tickMs, 2000);
  assert.strictEqual(store.getOrCreate("bot-a"), first);
});

test("replace clamps persisted self-guard values to existing limits", () => {
  const store = new SelfGuardConfigStore();
  const config = store.replace("bot-a", {
    enabled: true,
    tickMs: 100,
    lowFood: 99,
    lowHealth: 99,
    criticalHealth: 99,
    retaliationMaxDistance: 99,
    retaliationDecayMs: 1,
    alertCooldownMs: 999_999
  });

  assert.equal(config.enabled, true);
  assert.equal(config.tickMs, 500);
  assert.equal(config.lowFood, 19);
  assert.equal(config.lowHealth, 20);
  assert.equal(config.criticalHealth, 20);
  assert.equal(config.retaliationMaxDistance, 10);
  assert.equal(config.retaliationDecayMs, 10_000);
  assert.equal(config.alertCooldownMs, 300_000);
});

test("replace preserves explicit false values and dependent health thresholds", () => {
  const store = new SelfGuardConfigStore();
  const config = store.replace("bot-a", {
    lowFood: -5,
    lowHealth: 4,
    criticalHealth: 12,
    autoEat: false,
    autoStopFollowOnLowHealth: false,
    retaliateOnNonWhitelistHit: false,
    retaliationMaxDistance: -1,
    retaliationDecayMs: 99_999_999,
    chatAlerts: false,
    alertCooldownMs: -1
  });

  assert.equal(config.lowFood, 1);
  assert.equal(config.lowHealth, 4);
  assert.equal(config.criticalHealth, 4);
  assert.equal(config.autoEat, false);
  assert.equal(config.autoStopFollowOnLowHealth, false);
  assert.equal(config.retaliateOnNonWhitelistHit, false);
  assert.equal(config.retaliationMaxDistance, 1);
  assert.equal(config.retaliationDecayMs, 30 * 60 * 1000);
  assert.equal(config.chatAlerts, false);
  assert.equal(config.alertCooldownMs, 1000);

  const reset = store.replace("bot-a", {});
  assert.equal(reset.autoEat, true);
  assert.equal(reset.chatAlerts, true);
  assert.equal(reset.lowHealth, 10);
  assert.equal(reset.criticalHealth, 6);
});

test("persisted self-guard records are isolated and removed bot detection stays ordered", () => {
  const store = new SelfGuardConfigStore();
  const first = store.getOrCreate("bot-a");
  first.enabled = true;
  first.tickMs = 5000;
  store.getOrCreate("bot-b");
  store.getOrCreate("bot-c");

  const persisted = store.toPersistedRecord();
  persisted["bot-a"]!.enabled = false;
  persisted["bot-a"]!.tickMs = 30_000;
  assert.equal(first.enabled, true);
  assert.equal(first.tickMs, 5000);
  assert.deepEqual(store.getRemovedBotIds({ "bot-c": {} }), ["bot-a", "bot-b"]);
  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.get("bot-a"), undefined);
});
