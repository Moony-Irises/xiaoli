import assert from "node:assert/strict";
import test from "node:test";
import { buildDirectiveFromPlan } from "../src/agent/plan-to-directive.js";

test("buildDirectiveFromPlan preserves explicit action order and metadata", () => {
  const result = buildDirectiveFromPlan("bot", "wait", {
    intent: "execute_skill",
    directive: {
      goal: " Stay nearby ",
      rationale: " explicit ",
      desiredMode: "assist",
      actions: [
        { kind: "stop_follow", priority: "high", style: "quiet" },
        { kind: "idle" }
      ]
    }
  }, 2);

  assert.deepEqual(result.leftoverSteps, []);
  assert.equal(result.directive?.goal, "Stay nearby");
  assert.equal(result.directive?.rationale, "explicit");
  assert.equal(result.directive?.desiredMode, "assist");
  assert.deepEqual(result.directive?.actions.map((action) => action.kind), ["stop_follow", "idle"]);
  assert.equal(result.directive?.actions[0]?.priority, "high");
  assert.equal(result.directive?.actions[0]?.style, "quiet");
});

test("buildDirectiveFromPlan maps legacy steps and keeps unknown tools for permission checks", () => {
  const result = buildDirectiveFromPlan("bot", "eat and observe", {
    intent: "execute_skill",
    steps: [
      { tool: " interact.eat ", arguments: { food: "bread" } },
      { tool: " observe.self ", speak: " Look. " }
    ]
  }, 2);

  assert.deepEqual(result.directive?.actions.map((action) => action.kind), ["eat_food"]);
  assert.deepEqual(result.directive?.actions[0]?.params, { food: "bread" });
  assert.deepEqual(result.leftoverSteps, [{ tool: "observe.self", arguments: {}, speak: "Look." }]);
});

test("buildDirectiveFromPlan rejects incomplete mappings without inventing an action", () => {
  const result = buildDirectiveFromPlan("bot", "move", {
    intent: "execute_skill",
    steps: [
      { tool: "move.followPlayer", arguments: {} },
      { tool: "move.goToPosition", arguments: { x: 1, y: 2 } }
    ]
  }, 2);

  assert.equal(result.directive, null);
  assert.deepEqual(result.leftoverSteps, [
    { tool: "move.followPlayer", arguments: {}, speak: undefined },
    { tool: "move.goToPosition", arguments: { x: 1, y: 2 }, speak: undefined }
  ]);
});

test("buildDirectiveFromPlan enforces the action limit after speech is added", () => {
  const result = buildDirectiveFromPlan("bot", "wait", {
    intent: "execute_skill",
    speak: " Ready. ",
    directive: { actions: [{ kind: "stop_follow" }, { kind: "idle" }] }
  }, 1);

  assert.deepEqual(result.directive?.actions.map((action) => action.kind), ["speak"]);
  assert.deepEqual(result.directive?.actions[0]?.params, { text: "Ready." });
});
