import assert from "node:assert/strict";
import test from "node:test";
import { MovementIntentStore } from "../src/runtime/movement-intent-store.js";

test("movement intent store isolates keys by bot", () => {
  const store = new MovementIntentStore();

  store.set("bot-a", "follow:1");
  store.set("bot-b", "goto:2");

  assert.equal(store.get("bot-a"), "follow:1");
  assert.equal(store.get("bot-b"), "goto:2");
  assert.equal(store.has("bot-a"), true);
  assert.equal(store.has("bot-c"), false);
});

test("movement intent store replaces a bot key without affecting other bots", () => {
  const store = new MovementIntentStore();

  store.set("bot-a", "follow:old");
  store.set("bot-b", "duel:stable");
  store.set("bot-a", "follow:new");

  assert.equal(store.get("bot-a"), "follow:new");
  assert.equal(store.get("bot-b"), "duel:stable");
});

test("movement intent store deletes only the requested bot key", () => {
  const store = new MovementIntentStore();

  store.set("bot-a", "goto:1");
  store.set("bot-b", "mine:2");

  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.delete("bot-a"), false);
  assert.equal(store.get("bot-a"), undefined);
  assert.equal(store.has("bot-b"), true);
});
