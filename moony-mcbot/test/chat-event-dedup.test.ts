import assert from "node:assert/strict";
import test from "node:test";
import { createChatEventDeduplicator } from "../src/runtime/chat-event-dedup.js";

test("chat event deduplicator suppresses chat/messagestr duplicates in a short window", () => {
  const deduplicator = createChatEventDeduplicator(1500);

  assert.equal(deduplicator.accept("bot", "Judy", "小狸 跟着我", 1000), true);
  assert.equal(deduplicator.accept("bot", "Judy", "小狸   跟着我", 1100), false);
  assert.equal(deduplicator.accept("bot", "Judy", "小狸 跟着我", 2701), true);
  assert.equal(deduplicator.accept("bot", "Alex", "小狸 跟着我", 1100), true);
  assert.equal(deduplicator.accept("other-bot", "Judy", "小狸 跟着我", 1100), true);
});

test("chat event deduplicator clears state when a bot listener is replaced", () => {
  const deduplicator = createChatEventDeduplicator();

  assert.equal(deduplicator.accept("bot", "Judy", "hi", 1000), true);
  deduplicator.clearBot("bot");
  assert.equal(deduplicator.accept("bot", "Judy", "hi", 1001), true);
});
