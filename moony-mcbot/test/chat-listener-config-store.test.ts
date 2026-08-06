import assert from "node:assert/strict";
import test from "node:test";
import { ChatListenerConfigStore } from "../src/config/chat-listener-config-store.js";

test("chat listener config defaults are stable and isolated between bots", () => {
  const store = new ChatListenerConfigStore();
  const first = store.getOrCreate("bot-a");
  const second = store.getOrCreate("bot-b");

  assert.equal(store.getOrCreate("bot-a"), first);
  assert.equal(first.enabled, false);
  assert.deepEqual(first.wakeNames, ["小狸"]);
  assert.deepEqual(first.intents.follow, ["来我这", "跟我", "跟着我", "跟上我", "来一下", "跟过来"]);
  assert.deepEqual(first.specialReplies, [
    { trigger: "hi小狸", reply: "hihi", matchMode: "includes" }
  ]);

  first.wakeNames.push("狸");
  first.intents.follow.push("新增指令");
  first.specialReplies[0]!.reply = "changed";

  assert.deepEqual(second.wakeNames, ["小狸"]);
  assert.equal(second.intents.follow.includes("新增指令"), false);
  assert.equal(second.specialReplies[0]?.reply, "hihi");
});

test("replace preserves persisted chat listener normalization semantics", () => {
  const store = new ChatListenerConfigStore();
  const replaced = store.replace("bot-a", {
    enabled: true,
    whitelist: ["", "Judy"],
    wakeNames: ["", "小狸", "狸"],
    dotPrefix: ".....",
    intents: {
      follow: ["", "跟过来"],
      stop: []
    },
    specialReplies: [
      { trigger: "", reply: "ignored" },
      { trigger: "hello", reply: "嗯。", matchMode: "exact" },
      { trigger: "yo", reply: "哦。" }
    ]
  });

  assert.equal(replaced.enabled, true);
  assert.deepEqual([...replaced.whitelist], ["Judy"]);
  assert.deepEqual(replaced.wakeNames, ["小狸", "狸"]);
  assert.equal(replaced.dotPrefix, "....");
  assert.deepEqual(replaced.intents.follow, ["跟过来"]);
  assert.deepEqual(replaced.intents.stop, []);
  assert.deepEqual(replaced.intents.status, ["在干什么", "在做什么"]);
  assert.deepEqual(replaced.specialReplies, [
    { trigger: "hello", reply: "嗯。", matchMode: "exact" },
    { trigger: "yo", reply: "哦。", matchMode: "includes" }
  ]);
});

test("replace rebuilds defaults while preserving omitted and explicit empty array behavior", () => {
  const store = new ChatListenerConfigStore();
  const original = store.getOrCreate("bot-a");
  original.enabled = true;
  original.wakeNames.push("狸");
  original.intents.follow.length = 0;
  original.specialReplies.length = 0;

  const omitted = store.replace("bot-a", {});
  assert.notEqual(omitted, original);
  assert.equal(omitted.enabled, false);
  assert.deepEqual(omitted.wakeNames, []);
  assert.deepEqual(omitted.intents.follow, ["来我这", "跟我", "跟着我", "跟上我", "来一下", "跟过来"]);
  assert.deepEqual(omitted.specialReplies, [
    { trigger: "hi小狸", reply: "hihi", matchMode: "includes" }
  ]);

  const explicitEmpty = store.replace("bot-a", {
    wakeNames: [],
    intents: { follow: [] },
    specialReplies: []
  });
  assert.deepEqual(explicitEmpty.wakeNames, []);
  assert.deepEqual(explicitEmpty.intents.follow, []);
  assert.deepEqual(explicitEmpty.specialReplies, []);
});

test("persisted records are deep copies and removed bot detection stays ordered", () => {
  const store = new ChatListenerConfigStore();
  const first = store.getOrCreate("bot-a");
  store.getOrCreate("bot-b");
  first.whitelist.add("Judy");

  const persisted = store.toPersistedRecord();
  persisted["bot-a"]!.whitelist!.push("Mallory");
  persisted["bot-a"]!.intents!.follow!.push("mutated");
  persisted["bot-a"]!.specialReplies![0]!.reply = "mutated";

  assert.deepEqual([...first.whitelist], ["Judy"]);
  assert.equal(first.intents.follow.includes("mutated"), false);
  assert.equal(first.specialReplies[0]?.reply, "hihi");
  assert.deepEqual(store.getRemovedBotIds({ "bot-b": {} }), ["bot-a"]);
  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.get("bot-a"), undefined);
  assert.deepEqual(Object.keys(store.toPersistedRecord()), ["bot-b"]);
});
