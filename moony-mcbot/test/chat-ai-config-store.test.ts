import assert from "node:assert/strict";
import test from "node:test";
import {
  createRunningAiRequestStatus,
  finishAiRequestStatus
} from "../src/runtime/ai-request.js";
import { AiRequestLifecycle } from "../src/runtime/ai-request-lifecycle.js";
import {
  ChatAiConfigStore,
  type ChatAiConfigDefaults
} from "../src/config/chat-ai-config-store.js";

function createDefaults(overrides: Partial<ChatAiConfigDefaults> = {}): ChatAiConfigDefaults {
  return {
    apiBaseUrl: "https://api.example.test/v1",
    apiKey: "runtime-secret",
    model: "default-model",
    systemPrompt: "current prompt",
    requestTimeoutMs: 12_345,
    ...overrides
  };
}

test("chat AI config defaults are stable and isolated between bots", () => {
  let defaultCalls = 0;
  const store = new ChatAiConfigStore({
    createDefaults: () => {
      defaultCalls += 1;
      return createDefaults();
    }
  });

  const first = store.getOrCreate("bot-a");
  const second = store.getOrCreate("bot-b");

  assert.equal(defaultCalls, 2);
  assert.deepEqual(first, {
    enabled: false,
    whitelist: new Set<string>(),
    wakeWord: "小狸",
    cooldownMs: 3000,
    maxSentences: 3,
    sentenceDelayMs: 3000,
    maxHistory: 8,
    apiBaseUrl: "https://api.example.test/v1",
    apiKey: "runtime-secret",
    model: "default-model",
    modelFallbacks: [],
    systemPrompt: "current prompt",
    history: [],
    lastTriggeredAtByUser: new Map<string, number>(),
    lastRequest: {
      state: "idle",
      startedAt: null,
      finishedAt: null,
      timeoutMs: 12_345
    }
  });
  assert.notStrictEqual(first.whitelist, second.whitelist);
  assert.notStrictEqual(first.modelFallbacks, second.modelFallbacks);
  assert.notStrictEqual(first.history, second.history);
  assert.notStrictEqual(first.lastTriggeredAtByUser, second.lastTriggeredAtByUser);
  assert.notStrictEqual(first.lastRequest, second.lastRequest);

  first.whitelist.add("Judy");
  first.history.push({ role: "user", content: "hello" });
  assert.equal(second.whitelist.size, 0);
  assert.equal(second.history.length, 0);
  assert.strictEqual(store.getOrCreate("bot-a"), first);
  assert.equal(defaultCalls, 2);
});

test("replace preserves persisted Chat AI normalization and ignores file secrets", () => {
  const store = new ChatAiConfigStore({
    createDefaults: () => createDefaults({ apiKey: "" })
  });

  const replaced = store.replace("bot-a", {
    enabled: true,
    whitelist: ["Judy", ""],
    wakeWord: "",
    cooldownMs: 99_999,
    maxSentences: 0,
    sentenceDelayMs: -10,
    maxHistory: 99,
    apiBaseUrl: "",
    apiKey: "legacy-file-secret",
    model: "",
    modelFallbacks: ["glm", " glm ", "", "glm", "qwen"],
    systemPrompt: "stale persisted prompt"
  });

  assert.equal(replaced.ignoredPersistedApiKey, true);
  assert.deepEqual(replaced.config.whitelist, new Set(["Judy"]));
  assert.equal(replaced.config.wakeWord, "小狸");
  assert.equal(replaced.config.cooldownMs, 60_000);
  assert.equal(replaced.config.maxSentences, 1);
  assert.equal(replaced.config.sentenceDelayMs, 0);
  assert.equal(replaced.config.maxHistory, 30);
  assert.equal(replaced.config.apiBaseUrl, "https://api.example.test/v1");
  assert.equal(replaced.config.apiKey, "");
  assert.equal(replaced.config.model, "default-model");
  assert.deepEqual(replaced.config.modelFallbacks, ["glm", "qwen"]);
  assert.equal(replaced.config.systemPrompt, "current prompt");
});

test("replace retains runtime-only Chat AI state for an existing bot", () => {
  const store = new ChatAiConfigStore({
    createDefaults: () => createDefaults({ apiKey: "environment-key" })
  });
  const previous = store.getOrCreate("bot-a");
  previous.apiKey = "runtime-key";
  previous.history.push({ role: "user", content: "Judy: hi" });
  previous.lastTriggeredAtByUser.set("Judy", 42);
  previous.lastRequest = createRunningAiRequestStatus(5000, "old-model");

  const previousHistory = previous.history;
  const previousCooldowns = previous.lastTriggeredAtByUser;
  const previousRequest = previous.lastRequest;
  const replaced = store.replace("bot-a", {
    enabled: true,
    whitelist: ["Judy"],
    model: "new-model",
    apiKey: "ignored-file-key"
  });

  assert.notStrictEqual(replaced.config, previous);
  assert.equal(replaced.ignoredPersistedApiKey, false);
  assert.equal(replaced.config.apiKey, "runtime-key");
  assert.strictEqual(replaced.config.history, previousHistory);
  assert.strictEqual(replaced.config.lastTriggeredAtByUser, previousCooldowns);
  assert.strictEqual(replaced.config.lastRequest, previousRequest);
  assert.equal(replaced.config.model, "new-model");
  assert.deepEqual(replaced.config.whitelist, new Set(["Judy"]));
});

test("persisted Chat AI records are isolated and exclude runtime-only state", () => {
  const store = new ChatAiConfigStore({
    createDefaults: () => createDefaults()
  });
  const first = store.getOrCreate("bot-a");
  first.whitelist.add("Judy");
  first.modelFallbacks.push("fallback-model");
  first.history.push({ role: "assistant", content: "嗯。" });
  first.lastTriggeredAtByUser.set("Judy", 100);
  store.getOrCreate("bot-b");

  const persisted = store.toPersistedRecord();
  const firstPersisted = persisted["bot-a"]!;
  assert.equal(Object.hasOwn(firstPersisted, "apiKey"), false);
  assert.equal(Object.hasOwn(firstPersisted, "history"), false);
  assert.equal(Object.hasOwn(firstPersisted, "lastTriggeredAtByUser"), false);
  assert.equal(Object.hasOwn(firstPersisted, "lastRequest"), false);

  firstPersisted.whitelist!.push("Mutated");
  firstPersisted.modelFallbacks!.push("mutated-model");
  assert.deepEqual([...first.whitelist], ["Judy"]);
  assert.deepEqual(first.modelFallbacks, ["fallback-model"]);
  assert.deepEqual(store.getRemovedBotIds({ "bot-b": {} }), ["bot-a"]);
  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.get("bot-a"), undefined);
});

test("prompt updates apply to every existing Chat AI config", () => {
  const store = new ChatAiConfigStore({
    createDefaults: () => createDefaults()
  });
  const first = store.getOrCreate("bot-a");
  const second = store.getOrCreate("bot-b");

  assert.equal(store.applySystemPrompt("reloaded prompt"), 2);
  assert.equal(first.systemPrompt, "reloaded prompt");
  assert.equal(second.systemPrompt, "reloaded prompt");
  assert.equal(store.applySystemPrompt("next prompt"), 2);
});

test("request lifecycle writes completion status into the current config after replace", () => {
  const store = new ChatAiConfigStore({
    createDefaults: () => createDefaults()
  });
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (botId, status) => store.setLastRequest(botId, status)
  });
  const running = createRunningAiRequestStatus(5000, "old-model");
  const request = lifecycle.begin("bot-a", running);

  const replaced = store.replace("bot-a", { model: "new-model" }).config;
  const success = finishAiRequestStatus(running, "success", { model: "old-model" });
  assert.equal(request.update(success), true);
  assert.strictEqual(replaced.lastRequest, success);
  assert.equal(store.setLastRequest("missing", success), false);
});

test("cooldown cleanup cannot remove a newer trigger timestamp", () => {
  const store = new ChatAiConfigStore({
    createDefaults: () => createDefaults()
  });
  const config = store.getOrCreate("bot-a");
  config.lastTriggeredAtByUser.set("Judy", 20);

  assert.equal(store.clearTriggerIfCurrent("bot-a", "Judy", 10), false);
  assert.equal(config.lastTriggeredAtByUser.get("Judy"), 20);
  assert.equal(store.clearTriggerIfCurrent("bot-a", "Judy", 20), true);
  assert.equal(config.lastTriggeredAtByUser.has("Judy"), false);
  assert.equal(store.clearTriggerIfCurrent("missing", "Judy", 20), false);
});
