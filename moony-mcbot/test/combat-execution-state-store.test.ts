import assert from "node:assert/strict";
import test from "node:test";
import { CombatExecutionStateStore } from "../src/runtime/combat-execution-state-store.js";

test("combat execution state keeps equip timing and hit sequence together", () => {
  const store = new CombatExecutionStateStore();

  assert.equal(store.getLastEquipAt("bot-a"), undefined);
  store.recordEquip("bot-a", 1000);

  assert.equal(store.nextHitIndex("bot-a"), 1);
  assert.equal(store.nextHitIndex("bot-a"), 2);
  assert.equal(store.getLastEquipAt("bot-a"), 1000);
});

test("combat execution state stays isolated by bot", () => {
  const store = new CombatExecutionStateStore();

  store.recordEquip("bot-a", 1000);
  store.recordEquip("bot-b", 2000);
  assert.equal(store.nextHitIndex("bot-a"), 1);
  assert.equal(store.nextHitIndex("bot-a"), 2);
  assert.equal(store.nextHitIndex("bot-b"), 1);

  assert.equal(store.getLastEquipAt("bot-a"), 1000);
  assert.equal(store.getLastEquipAt("bot-b"), 2000);
});

test("recording an equip timestamp preserves the current hit sequence", () => {
  const store = new CombatExecutionStateStore();

  assert.equal(store.nextHitIndex("bot-a"), 1);
  store.recordEquip("bot-a", 0);
  store.recordEquip("bot-a", 2500);

  assert.equal(store.getLastEquipAt("bot-a"), 2500);
  assert.equal(store.nextHitIndex("bot-a"), 2);
});

test("clearing combat execution state removes only the requested bot", () => {
  const store = new CombatExecutionStateStore();
  store.recordEquip("bot-a", 1000);
  store.recordEquip("bot-b", 2000);
  store.nextHitIndex("bot-a");
  store.nextHitIndex("bot-b");

  assert.equal(store.clearBot("bot-a"), true);
  assert.equal(store.clearBot("bot-a"), false);
  assert.equal(store.getLastEquipAt("bot-a"), undefined);
  assert.equal(store.nextHitIndex("bot-a"), 1);
  assert.equal(store.getLastEquipAt("bot-b"), 2000);
  assert.equal(store.nextHitIndex("bot-b"), 2);
});

test("combat execution state rejects invalid equip timestamps without mutation", () => {
  const store = new CombatExecutionStateStore();
  store.recordEquip("bot-a", 1000);

  assert.throws(() => store.recordEquip("bot-a", -1), RangeError);
  assert.throws(() => store.recordEquip("bot-a", Number.NaN), RangeError);
  assert.throws(() => store.recordEquip("bot-a", Number.POSITIVE_INFINITY), RangeError);
  assert.equal(store.getLastEquipAt("bot-a"), 1000);
});
