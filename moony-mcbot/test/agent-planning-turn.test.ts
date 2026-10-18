import assert from "node:assert/strict";
import test from "node:test";
import { AiRequestError, type AiRequestStatus } from "../src/runtime/ai-request.js";
import { AiRequestLifecycle } from "../src/runtime/ai-request-lifecycle.js";
import { HierarchicalAgentRuntime } from "../src/agent/runtime.js";
import { AgentPlanningTurnCoordinator, type AgentPlanningTurnConfig } from "../src/agent/planning-turn-coordinator.js";
import {
  AgentPlanTranslationError,
  DefaultAgentPlanningStrategy,
  type AgentPlanningDecision,
  type AgentPlanningStrategy
} from "../src/agent/planning-strategy.js";
import type { AgentRuntimeDiagnosticsUpdate } from "../src/config/agent-config-store.js";
import type { AgentPlan } from "../src/agent/openai-agent-planner.js";

function deferred<T>(): { promise: Promise<T>; resolve(value: T): void; reject(error: unknown): void } {
  let resolvePromise: (value: T) => void = () => { throw new Error("deferred not initialized"); };
  let rejectPromise: (error: unknown) => void = () => { throw new Error("deferred not initialized"); };
  const promise = new Promise<T>((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function config(): AgentPlanningTurnConfig {
  return {
    plannerApiBaseUrl: "https://planner.invalid/v1", plannerApiKey: "test-key", plannerModel: "test-model",
    plannerSystemPrompt: "JSON", allowedTools: ["observe.self"], lastPlanAt: 0, planCooldownMs: 5000, maxPlanSteps: 3
  };
}

function idle(): AgentPlanningDecision {
  return { plan: { intent: "no_action" }, directive: null, leftoverSteps: [] };
}

function executable(): AgentPlanningDecision {
  return {
    plan: { intent: "execute_skill", directive: { milestones: ["First", "Next"], currentMilestoneIndex: 1 } },
    directive: { id: "decision", goal: "Recover", createdAt: 10000, actions: [
      { id: "action", kind: "eat_food", params: {}, priority: "high", source: "llm", createdAt: 10000 }
    ] },
    leftoverSteps: [{ tool: "observe.self" }]
  };
}

function fixture(strategy: AgentPlanningStrategy, sendSpeech: () => Promise<void> = async () => {}) {
  const statuses: Array<{ botId: string; status: AiRequestStatus }> = [];
  const diagnostics: Array<{ botId: string; update: AgentRuntimeDiagnosticsUpdate }> = [];
  const effects: Array<{ botId: string; kind: string }> = [];
  const goals: AgentPlanningDecision[] = [];
  const failures: unknown[] = [];
  const runtimes = new Map<string, HierarchicalAgentRuntime>();
  const clock = { value: 10000 };
  const lifecycle = new AiRequestLifecycle({ writeStatus: (botId, status) => {
    statuses.push({ botId, status }); return true;
  } });
  const getRuntime = (botId: string): HierarchicalAgentRuntime => {
    let runtime = runtimes.get(botId);
    if (!runtime) {
      runtime = new HierarchicalAgentRuntime(botId, undefined, { reactiveRules: [] });
      runtimes.set(botId, runtime);
    }
    return runtime;
  };
  const coordinator = new AgentPlanningTurnCoordinator(strategy, lifecycle, {
    getRuntime,
    syncState: () => {},
    captureState: (botId) => ({ botId, observation: "local" }),
    updateDiagnostics: (botId, update) => { diagnostics.push({ botId, update }); },
    updateGoal: (botId, _source, decision) => { effects.push({ botId, kind: "goal" }); goals.push(decision); },
    sendSpeech: async (botId) => { effects.push({ botId, kind: "speech" }); await sendSpeech(); },
    enqueueSteps: (botId) => { effects.push({ botId, kind: "enqueue" }); },
    startExecutor: (botId) => { effects.push({ botId, kind: "executor" }); },
    finishTurn: (botId) => { effects.push({ botId, kind: "finish" }); }
  }, () => clock.value);
  return {
    lifecycle, statuses, diagnostics, effects, goals, failures, clock, getRuntime,
    run: (botId = "bot", userInstruction = "wait", cfg = config()) => coordinator.run({
      botId, userInstruction, config: cfg, requester: "Judy", source: "manual", timeoutMs: 1000,
      onFailure: (error) => { failures.push(error); }
    })
  };
}

test("planning turn applies the decision once and preserves result, goal metadata and event order", async () => {
  const decision = executable();
  const f = fixture({ decide: async () => decision });
  const result = await f.run();
  assert.strictEqual(result.plan, decision.plan);
  assert.strictEqual(result.plannedSteps, decision.leftoverSteps);
  assert.deepEqual(result.stateSnapshot, { botId: "bot", observation: "local" });
  assert.equal(result.executionResult, "applied_directive_1_action(s);enqueued_1_step(s)");
  assert.equal(f.getRuntime("bot").snapshot().queuedActions.length, 1);
  assert.deepEqual(f.goals, [decision]);
  assert.deepEqual(f.effects.map((effect) => effect.kind), ["goal", "enqueue", "executor", "finish"]);
  assert.deepEqual(f.getRuntime("bot").snapshot().executionEvents.map((event) => event.type), ["planner_requested", "planner_result"]);
  assert.deepEqual(f.statuses.map(({ status }) => status.state), ["running", "success"]);
  assert.equal(f.lifecycle.hasActive("bot"), false);
});

test("no_action keeps start-time cooldown, exact expiry and clock rollback boundaries", async () => {
  const gate = deferred<AgentPlanningDecision>();
  let calls = 0;
  const f = fixture({ decide: async () => { calls++; return gate.promise; } });
  const first = f.run();
  f.clock.value = 12000;
  gate.resolve(idle());
  assert.equal((await first).executionResult, "no_action");
  assert.equal(f.diagnostics[0]?.update.lastPlanAt, 10000);
  f.clock.value = 14999;
  await assert.rejects(f.run(), /cooling down \(1ms remaining\)/);
  f.clock.value = 9000;
  await assert.rejects(f.run(), /cooling down \(6000ms remaining\)/);
  assert.equal(calls, 1);
  f.clock.value = 15000;
  await f.run();
  assert.equal(calls, 2);
});

test("directive application retains completion-time runtime cooldown and start-time diagnostics", async (t) => {
  const gate = deferred<AgentPlanningDecision>();
  const f = fixture({ decide: async () => gate.promise });
  t.mock.method(Date, "now", () => f.clock.value);
  const pending = f.run();
  f.clock.value = 12000;
  gate.resolve(executable());
  await pending;
  assert.equal(f.diagnostics[0]?.update.lastPlanAt, 10000);
  assert.equal(f.getRuntime("bot").plannerCooldownRemaining(15000, 5000), 2000);
});

test("compatibility permission failure preserves an already applied directive and successful request status", async () => {
  const f = fixture({ decide: async () => executable() });
  const cfg = config();
  cfg.allowedTools = [];
  await assert.rejects(f.run("bot", "wait", cfg), /Tool 'observe.self' is not allowed for agent/);
  assert.equal(f.getRuntime("bot").snapshot().queuedActions.length, 1);
  assert.deepEqual(f.effects.map((effect) => effect.kind), ["goal"]);
  assert.equal(f.statuses.at(-1)?.status.state, "success");
  assert.equal(f.failures.length, 1);
  assert.equal(f.lifecycle.hasActive("bot"), false);
});

test("missing executable steps keep successful model diagnostics while reporting an execution error", async () => {
  const f = fixture({ decide: async () => ({ ...idle(), plan: { intent: "execute_skill" } }) });
  await assert.rejects(f.run(), /Agent plan missing executable step/);
  assert.equal(f.statuses.at(-1)?.status.state, "success");
  assert.deepEqual(f.effects, []);
});

test("request errors preserve identity and classification without applying decisions", async () => {
  for (const error of [new Error("failed"), new AiRequestError("timeout", "timed out"), "rejected"]) {
    const f = fixture({ decide: async () => { throw error; } });
    await assert.rejects(f.run(), (actual: unknown) => actual === error);
    assert.equal(f.statuses.at(-1)?.status.state, error instanceof AiRequestError ? "timeout" : "failed");
    assert.deepEqual(f.effects, []);
    assert.deepEqual(f.diagnostics, []);
    assert.equal(f.lifecycle.hasActive("bot"), false);
  }
});

test("translation failure preserves raw plan diagnostics, cooldown and original error identity", async () => {
  const error = new TypeError("malformed plan");
  const plan: AgentPlan = { intent: "execute_skill" };
  const f = fixture({ decide: async () => { throw new AgentPlanTranslationError(plan, error); } });
  await assert.rejects(f.run(), (actual: unknown) => actual === error);
  assert.equal(f.statuses.at(-1)?.status.state, "success");
  assert.equal(f.diagnostics[0]?.update.lastPlanSummary, JSON.stringify(plan));
  assert.deepEqual(f.effects, []);
});

test("cancelled and invalidated turns reject late decisions without goal, queue or speech effects", async () => {
  for (const operation of ["cancel", "invalidate", "invalidateAll"] as const) {
    const gate = deferred<AgentPlanningDecision>();
    const f = fixture({ decide: async () => gate.promise });
    const pending = f.run();
    const rejected = assert.rejects(pending, (error: unknown) => error instanceof AiRequestError && error.kind === "cancelled");
    if (operation === "invalidateAll") f.lifecycle.invalidateAll();
    else f.lifecycle[operation]("bot");
    gate.resolve(executable());
    await rejected;
    assert.deepEqual(f.effects, []);
    assert.deepEqual(f.diagnostics, []);
    assert.deepEqual(f.getRuntime("bot").snapshot().queuedActions, []);
    assert.deepEqual(f.getRuntime("bot").snapshot().executionEvents.map((event) => event.type), ["planner_requested"]);
    assert.deepEqual(f.statuses.map(({ status }) => status.state), operation === "cancel" ? ["running", "cancelled"] : ["running"]);
    assert.equal(f.failures.length, operation === "cancel" ? 1 : 0);
    assert.equal(f.lifecycle.hasActive("bot"), false);
  }
});

test("an older turn cannot commit or close a newer in-flight turn", async () => {
  const older = deferred<AgentPlanningDecision>();
  const newer = deferred<AgentPlanningDecision>();
  const f = fixture({ decide: async ({ userInstruction }) => userInstruction === "old" ? older.promise : newer.promise });
  const oldRequest = f.run("bot", "old");
  const rejected = assert.rejects(oldRequest, /cancelled/);
  const newRequest = f.run("bot", "new");
  older.resolve(executable());
  await rejected;
  assert.equal(f.lifecycle.hasActive("bot"), true);
  assert.deepEqual(f.effects, []);
  assert.deepEqual(f.failures, []);
  newer.resolve(idle());
  await newRequest;
  assert.deepEqual(f.statuses.map(({ status }) => status.state), ["running", "running", "success"]);
});

test("an older rejection cannot overwrite the completed newer turn or report a stale failure", async () => {
  const older = deferred<AgentPlanningDecision>();
  const f = fixture({ decide: async ({ userInstruction }) => userInstruction === "old" ? older.promise : idle() });
  const oldRequest = f.run("bot", "old");
  const rejected = assert.rejects(oldRequest, /cancelled/);
  await f.run("bot", "new");
  const before = structuredClone({ statuses: f.statuses, diagnostics: f.diagnostics, effects: f.effects });
  older.reject(new Error("old upstream failed"));
  await rejected;
  assert.deepEqual({ statuses: f.statuses, diagnostics: f.diagnostics, effects: f.effects }, before);
  assert.deepEqual(f.failures, []);
});

test("invalidating one bot does not prevent another bot from committing", async () => {
  const first = deferred<AgentPlanningDecision>();
  const second = deferred<AgentPlanningDecision>();
  const f = fixture({ decide: async ({ botId }) => botId === "a" ? first.promise : second.promise });
  const a = f.run("a");
  const rejected = assert.rejects(a, /cancelled/);
  const b = f.run("b");
  f.lifecycle.invalidate("a");
  first.resolve(executable()); second.resolve(executable());
  await rejected; await b;
  assert.equal(f.effects.every((effect) => effect.botId === "b"), true);
  assert.equal(f.getRuntime("a").snapshot().queuedActions.length, 0);
  assert.equal(f.getRuntime("b").snapshot().queuedActions.length, 1);
});

test("cancellation during asynchronous speech prevents remaining turn commits", async () => {
  for (const rejects of [false, true]) {
    const speech = deferred<void>();
    const started = deferred<void>();
    const f = fixture({ decide: async () => ({ ...idle(), plan: { intent: "no_action", speak: "Hi" } }) }, async () => {
      started.resolve(); await speech.promise;
    });
    const pending = f.run();
    const rejected = assert.rejects(pending, /cancelled/);
    await started.promise;
    f.lifecycle.cancel("bot");
    if (rejects) speech.reject(new Error("disconnected")); else speech.resolve();
    await rejected;
    assert.deepEqual(f.effects.map((effect) => effect.kind), ["speech"]);
    assert.equal(f.diagnostics.some(({ update }) => update.lastPlanResult !== undefined), false);
    assert.equal(f.statuses.at(-1)?.status.state, "cancelled");
    assert.equal(f.lifecycle.hasActive("bot"), false);
  }
});

test("best-effort speech failure still allows an active no_action turn to finish", async () => {
  const f = fixture({ decide: async () => ({ ...idle(), plan: { intent: "no_action", speak: "Hi" } }) }, async () => {
    throw new Error("chat unavailable");
  });
  assert.equal((await f.run()).executionResult, "no_action");
  assert.deepEqual(f.effects.map((effect) => effect.kind), ["speech", "finish"]);
  assert.equal(f.statuses.at(-1)?.status.state, "success");
});

test("default strategy and coordinator preserve mixed legacy decisions together", async () => {
  const plan: AgentPlan = { intent: "execute_skill", steps: [{ tool: "interact.eat" }, { tool: "observe.self" }] };
  const f = fixture(new DefaultAgentPlanningStrategy({ plan: async () => plan }));
  const result = await f.run();
  assert.strictEqual(result.plan, plan);
  assert.equal(result.executionResult, "applied_directive_1_action(s);enqueued_1_step(s)");
});
