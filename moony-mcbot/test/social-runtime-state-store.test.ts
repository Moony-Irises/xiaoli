import assert from "node:assert/strict";
import test from "node:test";
import { SocialRuntimeStateStore } from "../src/runtime/social-runtime-state-store.js";

test("social runtime state keeps interaction and proactive timing isolated by bot", () => {
  const store = new SocialRuntimeStateStore();

  assert.equal(store.getLastInteractionAt("bot-a"), undefined);
  assert.equal(store.initializeInteraction("bot-a", 1_000), 1_000);
  assert.equal(store.initializeInteraction("bot-a", 2_000), 1_000);
  store.recordInteraction("bot-a", 3_000);
  store.recordInteraction("bot-b", 4_000);
  store.recordProactiveSpeak("bot-a", 5_000);

  assert.equal(store.getLastInteractionAt("bot-a"), 3_000);
  assert.equal(store.getLastInteractionAt("bot-b"), 4_000);
  assert.equal(store.getLastProactiveSpeakAt("bot-a"), 5_000);
  assert.equal(store.getLastProactiveSpeakAt("bot-b"), undefined);
});

test("social runtime state copies memory chat context and preserves explicit mood values", () => {
  const store = new SocialRuntimeStateStore();
  const context = { player: "Judy", relation: "owner", at: 1_000 };

  store.recordMemoryChatContext("bot-a", context);
  store.setMood("bot-a", "警觉");
  store.setMood("bot-b", "");
  context.player = "Changed";

  const first = store.getMemoryChatContext("bot-a");
  assert.deepEqual(first, { player: "Judy", relation: "owner", at: 1_000 });
  assert.equal(store.getMood("bot-a"), "警觉");
  assert.equal(store.getMood("bot-b"), "");
  assert.equal(store.getMood("missing"), undefined);

  assert.ok(first);
  first.relation = "changed";
  assert.deepEqual(store.getMemoryChatContext("bot-a"), {
    player: "Judy",
    relation: "owner",
    at: 1_000
  });
});

test("social runtime state claims scene lines at the legacy cooldown boundaries", () => {
  const store = new SocialRuntimeStateStore();

  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 7_999, 8_000), false);
  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 8_000, 8_000), true);
  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 8_001, 8_000), false);
  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 7_999, 8_000), false);
  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 16_000, 8_000), true);
  assert.equal(store.claimSceneLine("bot-a", "idleMurmur", 8_000, 8_000), true);
  assert.equal(store.claimSceneLine("bot-b", "nearPlayer", 8_000, 8_000), true);
});

test("social runtime state clears only the requested bot", () => {
  const store = new SocialRuntimeStateStore();

  store.recordInteraction("bot-a", 1_000);
  store.recordProactiveSpeak("bot-a", 2_000);
  store.recordMemoryChatContext("bot-a", { player: "Judy", relation: "owner", at: 3_000 });
  store.setMood("bot-a", "平静");
  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 8_000, 8_000), true);
  store.recordInteraction("bot-b", 4_000);

  assert.equal(store.clearBot("bot-a"), true);
  assert.equal(store.clearBot("bot-a"), false);
  assert.equal(store.getLastInteractionAt("bot-a"), undefined);
  assert.equal(store.getLastProactiveSpeakAt("bot-a"), undefined);
  assert.equal(store.getMemoryChatContext("bot-a"), undefined);
  assert.equal(store.getMood("bot-a"), undefined);
  assert.equal(store.claimSceneLine("bot-a", "nearPlayer", 8_000, 8_000), true);
  assert.equal(store.getLastInteractionAt("bot-b"), 4_000);
});
