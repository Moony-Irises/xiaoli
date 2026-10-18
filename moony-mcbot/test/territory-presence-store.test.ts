import assert from "node:assert/strict";
import test from "node:test";
import {
  TerritoryPresenceStore,
  type TerritoryPresenceState
} from "../src/runtime/territory-presence-store.js";

const entered: TerritoryPresenceState = {
  enteredAt: 100,
  warnedAt: 200
};

const escalated: TerritoryPresenceState = {
  enteredAt: 100,
  warnedAt: 200,
  escalatedAt: 300
};

test("territory presence state is isolated by bot and returned as a copy", () => {
  const store = new TerritoryPresenceStore();
  const input = { ...entered };

  assert.equal(store.get("bot-a", "home:Intruder"), undefined);
  store.set("bot-a", "home:Intruder", input);

  input.enteredAt = 999;
  const output = store.get("bot-a", "home:Intruder");
  assert.deepEqual(output, entered);
  if (output) output.warnedAt = 999;

  assert.deepEqual(store.get("bot-a", "home:Intruder"), entered);
  assert.equal(store.get("bot-b", "home:Intruder"), undefined);
});

test("territory presence state replaces and deletes one composite key", () => {
  const store = new TerritoryPresenceStore();
  store.set("bot-a", "home:Intruder", entered);

  store.set("bot-a", "home:Intruder", escalated);
  assert.deepEqual(store.get("bot-a", "home:Intruder"), escalated);
  assert.equal(store.delete("bot-a", "home:Intruder"), true);
  assert.equal(store.delete("bot-a", "home:Intruder"), false);
  assert.equal(store.get("bot-a", "home:Intruder"), undefined);
});

test("territory presence prune only removes inactive keys for the selected bot", () => {
  const store = new TerritoryPresenceStore();
  store.set("bot-a", "home:Intruder", entered);
  store.set("bot-a", "gate:Other", escalated);
  store.set("bot-b", "home:Intruder", entered);

  assert.equal(store.prune("bot-a", new Set(["gate:Other"])), 1);
  assert.equal(store.get("bot-a", "home:Intruder"), undefined);
  assert.deepEqual(store.get("bot-a", "gate:Other"), escalated);
  assert.deepEqual(store.get("bot-b", "home:Intruder"), entered);
  assert.equal(store.prune("bot-a", new Set(["gate:Other"])), 0);
});

test("territory presence clearBot removes every composite key and preserves other bots", () => {
  const store = new TerritoryPresenceStore();
  store.set("bot-a", "home:Intruder", entered);
  store.set("bot-a", "gate:Other", escalated);
  store.set("bot-b", "home:Intruder", entered);

  assert.equal(store.clearBot("bot-a"), true);
  assert.equal(store.clearBot("bot-a"), false);
  assert.equal(store.get("bot-a", "home:Intruder"), undefined);
  assert.equal(store.get("bot-a", "gate:Other"), undefined);
  assert.deepEqual(store.get("bot-b", "home:Intruder"), entered);
});
