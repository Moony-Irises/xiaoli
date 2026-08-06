import assert from "node:assert/strict";
import test from "node:test";
import { createRunningAiRequestStatus } from "../src/runtime/ai-request.js";
import {
  AgentConfigStore,
  type AgentConfigDefaults
} from "../src/config/agent-config-store.js";

function createDefaults(overrides: Partial<AgentConfigDefaults> = {}): AgentConfigDefaults {
  return {
    plannerApiBaseUrl: "https://api.example.test/v1",
    plannerApiKey: "runtime-secret",
    plannerModel: "default-model",
    plannerSystemPrompt: "Return JSON.",
    requestTimeoutMs: 12_345,
    allowedTools: ["observe.self", "move.followPlayer"],
    ...overrides
  };
}

function createStore(overrides: Partial<AgentConfigDefaults> = {}): AgentConfigStore {
  return new AgentConfigStore({
    createDefaults: () => createDefaults(overrides),
    resolveAllowedTools: (persisted, fallback) =>
      [...(persisted ?? fallback)].map((value) => value.trim()).filter(Boolean)
  });
}

test("agent config defaults are stable and isolated between bots", () => {
  let defaultCalls = 0;
  const store = new AgentConfigStore({
    createDefaults: () => {
      defaultCalls += 1;
      return createDefaults();
    },
    resolveAllowedTools: (persisted, fallback) => [...(persisted ?? fallback)].filter(Boolean)
  });

  const first = store.getOrCreate("bot-a");
  const second = store.getOrCreate("bot-b");

  assert.equal(defaultCalls, 2);
  assert.deepEqual(first, {
    enabled: false,
    mode: "manual",
    whitelist: new Set<string>(),
    owner: "",
    commandWakeWord: "小狸",
    autoIdlePolicy: "none",
    plannerApiBaseUrl: "https://api.example.test/v1",
    plannerApiKey: "runtime-secret",
    plannerModel: "default-model",
    plannerSystemPrompt: "Return JSON.",
    planCooldownMs: 4000,
    maxPlanSteps: 1,
    maxToolCallsPerTurn: 1,
    allowProactiveAction: false,
    allowedTools: ["observe.self", "move.followPlayer"],
    lastPlanAt: 0,
    lastPlanSummary: "",
    lastPlanResult: "",
    lastPlannerRequest: {
      state: "idle",
      startedAt: null,
      finishedAt: null,
      timeoutMs: 12_345
    }
  });
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.whitelist, second.whitelist);
  assert.notStrictEqual(first.allowedTools, second.allowedTools);
  assert.notStrictEqual(first.lastPlannerRequest, second.lastPlannerRequest);

  first.whitelist.add("Judy");
  first.allowedTools.push("chat.send");
  assert.equal(second.whitelist.size, 0);
  assert.deepEqual(second.allowedTools, ["observe.self", "move.followPlayer"]);
  assert.strictEqual(store.getOrCreate("bot-a"), first);
  assert.equal(defaultCalls, 2);
});

test("replace preserves Agent normalization and delegates allowlist resolution", () => {
  const calls: Array<{ persisted: readonly string[] | undefined; fallback: readonly string[] }> = [];
  const store = new AgentConfigStore({
    createDefaults: () => createDefaults({ plannerApiKey: "" }),
    resolveAllowedTools: (persisted, fallback) => {
      calls.push({ persisted, fallback });
      return [...(persisted ?? fallback)].map((value) => value.trim()).filter(Boolean);
    }
  });

  const replaced = store.replace("bot-a", {
    enabled: true,
    mode: "auto",
    whitelist: ["Judy", ""],
    owner: "Judy",
    commandWakeWord: "",
    autoIdlePolicy: "follow_owner",
    plannerApiBaseUrl: "",
    plannerApiKey: "legacy-file-secret",
    plannerModel: "",
    plannerSystemPrompt: "",
    planCooldownMs: 99_999,
    maxPlanSteps: 0,
    maxToolCallsPerTurn: 99,
    allowProactiveAction: true,
    allowedTools: [" chat.send ", ""]
  });

  assert.equal(replaced.ignoredPersistedPlannerApiKey, true);
  assert.equal(replaced.config.enabled, true);
  assert.equal(replaced.config.mode, "auto");
  assert.deepEqual(replaced.config.whitelist, new Set(["Judy"]));
  assert.equal(replaced.config.owner, "Judy");
  assert.equal(replaced.config.commandWakeWord, "小狸");
  assert.equal(replaced.config.autoIdlePolicy, "follow_owner");
  assert.equal(replaced.config.plannerApiBaseUrl, "https://api.example.test/v1");
  assert.equal(replaced.config.plannerApiKey, "");
  assert.equal(replaced.config.plannerModel, "default-model");
  assert.equal(replaced.config.plannerSystemPrompt, "Return JSON.");
  assert.equal(replaced.config.planCooldownMs, 60_000);
  assert.equal(replaced.config.maxPlanSteps, 1);
  assert.equal(replaced.config.maxToolCallsPerTurn, 5);
  assert.equal(replaced.config.allowProactiveAction, true);
  assert.deepEqual(replaced.config.allowedTools, ["chat.send"]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.fallback, ["observe.self", "move.followPlayer"]);
});

test("replace retains runtime-only Agent state for an existing bot", () => {
  const store = createStore({ plannerApiKey: "environment-key" });
  const previous = store.getOrCreate("bot-a");
  previous.plannerApiKey = "runtime-key";
  previous.lastPlanAt = 42;
  previous.lastPlanSummary = "old summary";
  previous.lastPlanResult = "old result";
  previous.lastPlannerRequest = createRunningAiRequestStatus(5000, "old-model");
  const previousRequest = previous.lastPlannerRequest;

  const replaced = store.replace("bot-a", {
    enabled: true,
    owner: "Molly",
    plannerModel: "new-model",
    plannerApiKey: "ignored-file-key"
  });

  assert.notStrictEqual(replaced.config, previous);
  assert.equal(replaced.ignoredPersistedPlannerApiKey, false);
  assert.equal(replaced.config.plannerApiKey, "runtime-key");
  assert.equal(replaced.config.lastPlanAt, 42);
  assert.equal(replaced.config.lastPlanSummary, "old summary");
  assert.equal(replaced.config.lastPlanResult, "old result");
  assert.strictEqual(replaced.config.lastPlannerRequest, previousRequest);
  assert.equal(replaced.config.owner, "Molly");
  assert.equal(replaced.config.plannerModel, "new-model");
});

test("persisted Agent core records are isolated and exclude runtime or composed state", () => {
  const store = createStore();
  const first = store.getOrCreate("bot-a");
  first.whitelist.add("Judy");
  first.allowedTools.push("chat.send");
  first.lastPlanAt = 42;
  first.lastPlanSummary = "summary";
  first.lastPlanResult = "result";
  store.getOrCreate("bot-b");

  const persisted = store.toPersistedRecord();
  const firstPersisted = persisted["bot-a"]!;
  assert.equal(Object.hasOwn(firstPersisted, "plannerApiKey"), false);
  assert.equal(Object.hasOwn(firstPersisted, "lastPlanAt"), false);
  assert.equal(Object.hasOwn(firstPersisted, "lastPlanSummary"), false);
  assert.equal(Object.hasOwn(firstPersisted, "lastPlanResult"), false);
  assert.equal(Object.hasOwn(firstPersisted, "lastPlannerRequest"), false);
  assert.equal(Object.hasOwn(firstPersisted, "strategicGoal"), false);
  assert.equal(Object.hasOwn(firstPersisted, "memory"), false);
  assert.equal(Object.hasOwn(firstPersisted, "territory"), false);

  firstPersisted.whitelist!.push("Mutated");
  firstPersisted.allowedTools!.push("mutated.tool");
  assert.deepEqual([...first.whitelist], ["Judy"]);
  assert.deepEqual(first.allowedTools, ["observe.self", "move.followPlayer", "chat.send"]);
});

test("Agent bot IDs, removed detection, and deletion do not expose the backing Map", () => {
  const store = createStore();
  store.getOrCreate("bot-a");
  store.getOrCreate("bot-b");
  store.getOrCreate("bot-c");

  const botIds = store.getBotIds();
  botIds.push("external");
  assert.deepEqual(store.getBotIds(), ["bot-a", "bot-b", "bot-c"]);
  assert.deepEqual(store.getRemovedBotIds({ "bot-c": {} }), ["bot-a", "bot-b"]);
  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.get("bot-a"), undefined);
});

test("Agent runtime diagnostic writes target the current config", () => {
  const store = createStore();
  const previous = store.getOrCreate("bot-a");
  const running = createRunningAiRequestStatus(5000, "old-model");
  assert.equal(store.setLastPlannerRequest("bot-a", running), true);

  const current = store.replace("bot-a", { plannerModel: "new-model" }).config;
  const success = { ...running, state: "success" as const, finishedAt: "2026-08-03T00:00:00.000Z" };
  assert.equal(store.setLastPlannerRequest("bot-a", success), true);
  assert.equal(store.updateRuntimeDiagnostics("bot-a", {
    lastPlanAt: 42,
    lastPlanSummary: "summary",
    lastPlanResult: "result"
  }), true);

  assert.notStrictEqual(current, previous);
  assert.strictEqual(current.lastPlannerRequest, success);
  assert.equal(current.lastPlanAt, 42);
  assert.equal(current.lastPlanSummary, "summary");
  assert.equal(current.lastPlanResult, "result");
  assert.equal(store.setLastPlannerRequest("missing", success), false);
  assert.equal(store.updateRuntimeDiagnostics("missing", { lastPlanResult: "ignored" }), false);
});
