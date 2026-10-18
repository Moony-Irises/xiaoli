import assert from "node:assert/strict";
import test from "node:test";
import {
  TerritoryConfigStore,
  type TerritoryConfig
} from "../src/config/territory-config-store.js";

const defaultConfig: TerritoryConfig = {
  enabled: false,
  placeIds: [],
  requiredTags: [],
  radius: 12,
  warningCooldownMs: 30_000,
  warningMessage: "走开。",
  ownerPresencePolicy: "owner_nearby_only",
  escalationEnabled: true,
  escalationDelayMs: 8_000
};

function configuredTerritory(): TerritoryConfig {
  return {
    enabled: true,
    placeIds: ["home"],
    requiredTags: ["base"],
    radius: 18,
    warningCooldownMs: 12_000,
    warningMessage: "离远点。",
    ownerPresencePolicy: "always",
    escalationEnabled: false,
    escalationDelayMs: 5_000
  };
}

test("territory config defaults are isolated by bot and returned as copies", () => {
  const store = new TerritoryConfigStore();

  assert.equal(store.get("bot-a"), undefined);
  const first = store.getOrCreate("bot-a");
  assert.deepEqual(first, defaultConfig);

  first.enabled = true;
  first.placeIds.push("mutated-output");
  first.requiredTags.push("mutated-output");

  assert.deepEqual(store.get("bot-a"), defaultConfig);
  assert.deepEqual(store.getOrCreate("bot-b"), defaultConfig);
  assert.notStrictEqual(store.get("bot-a"), store.get("bot-a"));
});

test("territory config replacement copies input and output arrays", () => {
  const store = new TerritoryConfigStore();
  const input = configuredTerritory();

  const replaced = store.replace("bot-a", input);
  input.placeIds.push("mutated-input");
  input.requiredTags.push("mutated-input");
  replaced.placeIds.push("mutated-output");
  replaced.requiredTags.push("mutated-output");

  assert.deepEqual(store.get("bot-a"), configuredTerritory());
});

test("territory config replacement overwrites existing state", () => {
  const store = new TerritoryConfigStore();
  store.getOrCreate("bot-a");

  store.replace("bot-a", configuredTerritory());

  assert.deepEqual(store.getOrCreate("bot-a"), configuredTerritory());
});

test("territory config deletion is isolated and idempotent", () => {
  const store = new TerritoryConfigStore();
  store.replace("bot-a", configuredTerritory());
  store.getOrCreate("bot-b");

  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.delete("bot-a"), false);
  assert.equal(store.get("bot-a"), undefined);
  assert.deepEqual(store.get("bot-b"), defaultConfig);
});
