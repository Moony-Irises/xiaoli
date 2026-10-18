import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentTaskHistoryStore,
  type AgentTaskHistoryRecord
} from "../src/runtime/agent-task-history-store.js";

function record(id: string, overrides: Partial<AgentTaskHistoryRecord> = {}): AgentTaskHistoryRecord {
  return {
    id,
    taskType: "follow",
    status: "finished",
    source: "agent",
    goal: "Follow Judy",
    detail: `detail-${id}`,
    createdAt: Number(id.replace(/\D/g, "")) || 1,
    finishedAt: 100,
    ...overrides
  };
}

test("agent task history stays isolated per bot and returns copies", () => {
  const store = new AgentTaskHistoryStore();
  const first = record("task-1");
  store.record("bot-a", first);
  store.record("bot-b", record("task-2"));

  first.detail = "mutated input";
  const history = store.get("bot-a");
  history[0]!.detail = "mutated output";

  assert.equal(store.get("bot-a")[0]?.detail, "detail-task-1");
  assert.equal(store.get("bot-b")[0]?.id, "task-2");
  assert.deepEqual(store.get("missing"), []);
});

test("agent task history replacement and append keep the newest bounded entries", () => {
  const store = new AgentTaskHistoryStore({ maxEntries: 2 });
  store.replace("bot-a", [record("task-1"), record("task-2"), record("task-3")]);

  assert.deepEqual(store.get("bot-a").map((entry) => entry.id), ["task-2", "task-3"]);

  store.record("bot-a", record("task-4"));
  assert.deepEqual(store.get("bot-a").map((entry) => entry.id), ["task-3", "task-4"]);
});

test("agent task history defaults to the newest 20 entries", () => {
  const store = new AgentTaskHistoryStore();
  const records = Array.from({ length: 21 }, (_, index) => record(`task-${index + 1}`));

  store.replace("bot-a", records);

  assert.equal(store.get("bot-a").length, 20);
  assert.equal(store.get("bot-a")[0]?.id, "task-2");
  assert.equal(store.get("bot-a")[19]?.id, "task-21");
});

test("agent task history clear and delete preserve explicit lifecycle semantics", () => {
  const store = new AgentTaskHistoryStore();
  store.record("bot-a", record("task-1"));

  assert.equal(store.clear("bot-a"), true);
  assert.deepEqual(store.get("bot-a"), []);
  assert.equal(store.clear("bot-a"), false);
  assert.equal(store.delete("bot-a"), true);
  assert.equal(store.delete("bot-a"), false);
});

test("agent task history rejects a non-positive or non-integer bound", () => {
  assert.throws(() => new AgentTaskHistoryStore({ maxEntries: 0 }), /positive integer/);
  assert.throws(() => new AgentTaskHistoryStore({ maxEntries: 1.5 }), /positive integer/);
  assert.throws(() => new AgentTaskHistoryStore({ maxEntries: Number.NaN }), /positive integer/);
});
