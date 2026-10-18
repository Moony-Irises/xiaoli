import assert from "node:assert/strict";
import test from "node:test";
import { executeAgentRuntimeAction, type AgentRuntimeActionHooks } from "../src/agent/runtime-action-executor.js";
import { HierarchicalAgentRuntime } from "../src/agent/runtime.js";
import type { AgentEvent, StrategicAction } from "../src/agent/types.js";

function action(id: string, overrides: Partial<StrategicAction> = {}): StrategicAction {
  return { id, kind: "eat_food", params: {}, source: "llm", priority: "normal", createdAt: 1, ...overrides };
}

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void } {
  let resolvePromise: (value: T) => void = () => { throw new Error("deferred not initialized"); };
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

function fixture(runtime = new HierarchicalAgentRuntime("executor", undefined, { reactiveRules: [] })) {
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const results: string[] = [];
  const trace: string[] = [];
  const hooks: AgentRuntimeActionHooks = {
    getAllowedTools: () => { trace.push("permissions"); return ["interact.eat", "move.followPlayer"]; },
    canInterrupt: () => { trace.push("interrupt"); return true; },
    executeTool: async (tool, args) => {
      calls.push({ tool, args });
      return "executed";
    },
    updateLastResult: (result) => { results.push(result); }
  };
  return { runtime, hooks, calls, results, trace };
}

test("empty and uncompiled queues do not read permissions or consume actions", async () => {
  const f = fixture();
  assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), false);
  const compatibility = action("legacy", { kind: "tool_call", params: { tool: "observe.self" } });
  f.runtime.blackboard.enqueueActions([compatibility]);
  assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), false);
  assert.deepEqual(f.runtime.snapshot().queuedActions, [compatibility]);
  assert.deepEqual(f.trace, []);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.runtime.events.getRecent(), []);
});

test("permission denial consumes only the rejected action before checking task interruption", async () => {
  const f = fixture();
  f.hooks.getAllowedTools = () => { f.trace.push("permissions"); return []; };
  f.runtime.blackboard.enqueueActions([action("denied"), action("next")]);
  assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), false);
  assert.deepEqual(f.runtime.snapshot().queuedActions.map((item) => item.id), ["next"]);
  assert.equal(f.runtime.snapshot().activeAction, null);
  assert.equal(f.runtime.snapshot().activeSkill, null);
  assert.deepEqual(f.trace, ["permissions"]);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.results, []);
  const event = f.runtime.events.getRecent()[0];
  assert.equal(event?.type, "task_failed");
  assert.equal(event?.priority, "normal");
  assert.deepEqual(event?.payload, {
    taskType: "eat_food", detail: "hierarchical runtime blocked tool 'interact.eat'"
  });
});

test("task conflict retains the action until interruption becomes allowed", async () => {
  const f = fixture();
  const waiting = action("waiting");
  f.runtime.blackboard.enqueueActions([waiting]);
  f.hooks.canInterrupt = (tool) => {
    assert.equal(tool, "interact.eat");
    return false;
  };
  assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), false);
  assert.deepEqual(f.runtime.snapshot().queuedActions, [waiting]);
  assert.equal(f.runtime.snapshot().activeAction, null);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.runtime.events.getRecent(), []);
  f.hooks.canInterrupt = () => true;
  assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), true);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(f.runtime.snapshot().queuedActions, []);
});

test("permission rejection subscriber errors release active state without replaying the rejected action", async (t) => {
  for (const eventType of ["task_failed", "*"] as const) {
    await t.test(eventType, async () => {
      const f = fixture();
      f.hooks.getAllowedTools = () => [];
      f.runtime.blackboard.enqueueActions([action("denied"), action("next")]);
      const failure = new Error(`${eventType} subscriber failed`);
      const unsubscribe = f.runtime.events.subscribe(eventType, () => {
        assert.equal(f.runtime.snapshot().activeAction?.id, "denied");
        assert.equal(f.runtime.snapshot().activeSkill?.skill, "interact.eat");
        throw failure;
      });

      await assert.rejects(executeAgentRuntimeAction(f.runtime, f.hooks), (error) => error === failure);
      assert.equal(f.runtime.snapshot().activeAction, null);
      assert.equal(f.runtime.snapshot().activeSkill, null);
      assert.deepEqual(f.runtime.snapshot().queuedActions.map((item) => item.id), ["next"]);
      assert.deepEqual(f.calls, []);
      assert.deepEqual(f.results, []);
      assert.equal(f.runtime.events.getRecent().length, 1);
      assert.equal(f.runtime.events.getRecent()[0]?.priority, "normal");

      unsubscribe();
      f.hooks.getAllowedTools = () => ["interact.eat"];
      assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), true);
      assert.equal(f.calls.length, 1);
      assert.deepEqual(f.results, ["executed"]);
      assert.deepEqual(f.runtime.snapshot().queuedActions, []);
      assert.deepEqual(f.runtime.events.getRecent().map((event) => event.type), ["task_failed", "task_finished"]);
    });
  }
});

test("permission rejection cleanup does not release another bot's pending skill", async () => {
  const a = fixture(new HierarchicalAgentRuntime("denied-a", undefined, { reactiveRules: [] }));
  const b = fixture(new HierarchicalAgentRuntime("running-b", undefined, { reactiveRules: [] }));
  a.runtime.blackboard.enqueueActions([action("denied")]);
  b.runtime.blackboard.enqueueActions([action("running")]);
  const pending = deferred<string>();
  b.hooks.executeTool = () => pending.promise;
  const running = executeAgentRuntimeAction(b.runtime, b.hooks);
  a.hooks.getAllowedTools = () => [];
  const failure = new Error("denied subscriber failed");
  a.runtime.events.subscribe("task_failed", () => { throw failure; });

  try {
    await assert.rejects(executeAgentRuntimeAction(a.runtime, a.hooks), (error) => error === failure);
    assert.equal(a.runtime.snapshot().activeAction, null);
    assert.equal(a.runtime.snapshot().activeSkill, null);
    assert.equal(b.runtime.snapshot().activeAction?.id, "running");
    assert.equal(b.runtime.snapshot().activeSkill?.skill, "interact.eat");
    assert.deepEqual(b.runtime.events.getRecent(), []);
    assert.deepEqual(b.results, []);
  } finally {
    pending.resolve("b executed");
    await running;
  }
  assert.equal(b.runtime.snapshot().activeAction, null);
  assert.deepEqual(b.results, ["b executed"]);
});

test("running skill stays observable and records diagnostics before its terminal event and release", async () => {
  const f = fixture();
  const pending = deferred<string>();
  const first = action("running", { kind: "follow_player", params: { playerName: "Judy", minDistance: 3 } });
  f.runtime.blackboard.enqueueActions([first, action("next")]);
  f.hooks.executeTool = async (tool, args) => {
    f.calls.push({ tool, args });
    return pending.promise;
  };
  f.runtime.events.subscribe("task_finished", (event) => {
    assert.deepEqual(f.results, ["following Judy"]);
    assert.equal(f.runtime.snapshot().activeAction?.id, "running");
    assert.equal(f.runtime.snapshot().activeSkill?.skill, "move.followPlayer");
    assert.equal(event.payload.result, "following Judy");
  });
  const execution = executeAgentRuntimeAction(f.runtime, f.hooks);
  assert.deepEqual(f.calls, [{ tool: "move.followPlayer", args: { playerName: "Judy", minDistance: 3 } }]);
  assert.deepEqual(f.runtime.snapshot().activeAction, first);
  assert.equal(f.runtime.snapshot().activeSkill?.skill, "move.followPlayer");
  assert.deepEqual(f.results, []);
  assert.deepEqual(f.runtime.events.getRecent(), []);
  pending.resolve("following Judy");
  assert.equal(await execution, true);
  assert.deepEqual(f.runtime.snapshot().queuedActions.map((item) => item.id), ["next"]);
  assert.equal(f.runtime.snapshot().activeAction, null);
  assert.equal(f.runtime.snapshot().activeSkill, null);
  assert.equal(f.runtime.events.getRecent()[0]?.type, "task_finished");
  assert.equal(f.runtime.events.getRecent()[0]?.priority, "normal");
  assert.deepEqual(f.trace, ["permissions", "interrupt"]);
});

test("tool failures publish high priority evidence and allow the following action to run", async (t) => {
  for (const failure of [new Error("cannot eat"), "plain rejection", undefined]) {
    await t.test(String(failure), async () => {
      const f = fixture();
      f.runtime.blackboard.enqueueActions([action("failed"), action("next")]);
      const executeTool = f.hooks.executeTool;
      f.hooks.executeTool = async () => { throw failure; };
      assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), true);
      const message = failure instanceof Error ? failure.message : String(failure);
      assert.deepEqual(f.results, [message]);
      const event = f.runtime.events.getRecent()[0];
      assert.equal(event?.type, "task_failed");
      assert.equal(event?.priority, "high");
      assert.deepEqual(event?.payload, {
        taskType: "eat_food", detail: "failed interact.eat", skill: "interact.eat", lastError: message
      });
      assert.equal(f.runtime.snapshot().activeAction, null);
      assert.equal(f.runtime.snapshot().activeSkill, null);
      f.hooks.executeTool = executeTool;
      assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), true);
      assert.equal(f.calls.length, 1);
      assert.deepEqual(f.runtime.events.getRecent().map((item) => item.type), ["task_failed", "task_finished"]);
    });
  }
});

test("a missing binding after preview leaves the queue available without executing a tool", async (t) => {
  const f = fixture();
  f.runtime.blackboard.enqueueActions([action("pending")]);
  t.mock.method(f.runtime, "bindNextAction", () => null);
  assert.equal(await executeAgentRuntimeAction(f.runtime, f.hooks), false);
  assert.equal(f.runtime.snapshot().queuedActions[0]?.id, "pending");
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.results, []);
  assert.deepEqual(f.runtime.events.getRecent(), []);
});

test("diagnostic write errors still release the bound action and propagate through the legacy error path", async () => {
  const f = fixture();
  f.runtime.blackboard.enqueueActions([action("diagnostic-failure")]);
  const failure = new Error("diagnostic write failed");
  f.hooks.updateLastResult = () => { throw failure; };
  await assert.rejects(executeAgentRuntimeAction(f.runtime, f.hooks), (error) => error === failure);
  assert.equal(f.calls.length, 1);
  assert.equal(f.runtime.snapshot().activeAction, null);
  assert.equal(f.runtime.snapshot().activeSkill, null);
  assert.deepEqual(f.runtime.snapshot().queuedActions, []);
});

test("failure event subscriber errors propagate after active execution is released", async () => {
  const f = fixture();
  f.runtime.blackboard.enqueueActions([action("event-failure")]);
  f.hooks.executeTool = async () => { throw new Error("tool failed"); };
  const failure = new Error("subscriber failed");
  f.runtime.events.subscribe("task_failed", () => { throw failure; });
  await assert.rejects(executeAgentRuntimeAction(f.runtime, f.hooks), (error) => error === failure);
  assert.deepEqual(f.results, ["tool failed"]);
  assert.equal(f.runtime.snapshot().activeAction, null);
  assert.equal(f.runtime.snapshot().activeSkill, null);
});

test("reactive actions retain blackboard priority over a lower priority planned action", async () => {
  const runtime = new HierarchicalAgentRuntime("reactive-executor");
  const f = fixture(runtime);
  const planned = action("planned", { kind: "follow_player", params: { playerName: "Judy" } });
  runtime.blackboard.enqueueActions([planned]);
  const event: AgentEvent = {
    id: "hungry", type: "low_food", priority: "high", createdAt: 2, payload: { hasFood: true }
  };
  runtime.ingestEvent(event);
  assert.equal(await executeAgentRuntimeAction(runtime, f.hooks), true);
  assert.equal(f.calls[0]?.tool, "interact.eat");
  assert.deepEqual(runtime.snapshot().queuedActions, [planned]);
});

test("different bots keep pending execution, results and terminal events isolated", async () => {
  const a = fixture(new HierarchicalAgentRuntime("bot-a", undefined, { reactiveRules: [] }));
  const b = fixture(new HierarchicalAgentRuntime("bot-b", undefined, { reactiveRules: [] }));
  a.runtime.blackboard.enqueueActions([action("a")]);
  b.runtime.blackboard.enqueueActions([action("b")]);
  const pending = deferred<string>();
  a.hooks.executeTool = () => pending.promise;
  const executionA = executeAgentRuntimeAction(a.runtime, a.hooks);
  assert.equal(await executeAgentRuntimeAction(b.runtime, b.hooks), true);
  assert.equal(a.runtime.snapshot().activeAction?.id, "a");
  assert.equal(b.runtime.snapshot().activeAction, null);
  assert.deepEqual(a.results, []);
  assert.deepEqual(a.runtime.events.getRecent(), []);
  assert.deepEqual(b.results, ["executed"]);
  pending.resolve("a executed");
  assert.equal(await executionA, true);
  assert.deepEqual(a.results, ["a executed"]);
  assert.deepEqual(b.results, ["executed"]);
});
