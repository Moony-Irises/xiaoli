import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentPlanTranslationError,
  DefaultAgentPlanningStrategy,
  type AgentPlanningInput
} from "../src/agent/planning-strategy.js";
import type { AgentPlan } from "../src/agent/openai-agent-planner.js";

function input(): AgentPlanningInput {
  return {
    botId: "bot", userInstruction: "Eat and observe", maxPlanSteps: 2, timeoutMs: 1000,
    config: {
      plannerApiBaseUrl: "https://planner.invalid/v1", plannerApiKey: "test-key",
      plannerModel: "test-model", plannerSystemPrompt: "JSON", allowedTools: ["interact.eat"]
    },
    stateSnapshot: { source: "local" }, signal: new AbortController().signal
  };
}

test("planning strategy preserves the raw plan, milestones and request context", async () => {
  const request = input();
  const plan: AgentPlan = {
    intent: "execute_skill",
    directive: {
      goal: "Recover", rationale: " hungry ", milestones: ["Eat", "Wait"], currentMilestoneIndex: 1,
      desiredMode: "assist", actions: [{ kind: "eat_food" }, { kind: "idle" }, { kind: "stop_follow" }]
    }
  };
  const strategy = new DefaultAgentPlanningStrategy({
    plan: async (received) => {
      const { botId: _botId, maxPlanSteps: _maxPlanSteps, ...expected } = request;
      assert.deepEqual(received, expected);
      assert.strictEqual(received.signal, request.signal);
      return plan;
    }
  });

  const decision = await strategy.decide(request);
  assert.strictEqual(decision.plan, plan);
  assert.equal(decision.plan.directive?.currentMilestoneIndex, 1);
  assert.deepEqual(decision.plan.directive?.milestones, ["Eat", "Wait"]);
  assert.equal(decision.directive?.goal, "Recover");
  assert.equal(decision.directive?.rationale, "hungry");
  assert.deepEqual(decision.directive?.actions.map((action) => action.kind), ["eat_food", "idle"]);
  assert.deepEqual(decision.leftoverSteps, []);
});

test("planning strategy preserves unmapped legacy steps alongside mapped actions", async () => {
  const strategy = new DefaultAgentPlanningStrategy({ plan: async () => ({
    intent: "execute_skill", steps: [{ tool: "interact.eat" }, { tool: "observe.self" }]
  }) });
  const result = await strategy.decide(input());
  assert.deepEqual(result.directive?.actions.map((action) => action.kind), ["eat_food"]);
  assert.deepEqual(result.leftoverSteps, [{ tool: "observe.self", arguments: {}, speak: undefined }]);
});

test("planning strategy preserves no_action without creating a directive", async () => {
  const plan: AgentPlan = { intent: "no_action" };
  const strategy = new DefaultAgentPlanningStrategy({ plan: async () => plan });
  assert.deepEqual(await strategy.decide(input()), { plan, directive: null, leftoverSteps: [] });
});

test("planning strategy passes requester failures through unchanged", async () => {
  const error = new Error("upstream failed");
  const strategy = new DefaultAgentPlanningStrategy({ plan: async () => { throw error; } });
  await assert.rejects(strategy.decide(input()), (actual: unknown) => actual === error);
});

test("planning strategy distinguishes translation failure from request failure", async () => {
  const plan = { intent: "execute_skill", directive: { actions: {} } } as unknown as AgentPlan;
  const strategy = new DefaultAgentPlanningStrategy({ plan: async () => plan });
  await assert.rejects(strategy.decide(input()), (error: unknown) => {
    assert.ok(error instanceof AgentPlanTranslationError);
    assert.strictEqual(error.plan, plan);
    assert.ok(error.cause instanceof TypeError);
    return true;
  });
});
