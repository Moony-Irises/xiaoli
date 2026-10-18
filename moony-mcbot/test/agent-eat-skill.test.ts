import assert from "node:assert/strict";
import test from "node:test";
import { AgentBlackboard } from "../src/agent/blackboard.js";
import type { AgentPlan } from "../src/agent/openai-agent-planner.js";
import { buildDirectiveFromPlan } from "../src/agent/plan-to-directive.js";
import { createDefaultSkillCatalog } from "../src/agent/skill-catalog.js";
import { executeAgentEatTool } from "../src/agent/tool-executors.js";
import type { StrategicAction, SkillInvocation } from "../src/agent/types.js";
import type { EatFoodInput } from "../src/runtime/client-adapter.js";

function compileEat(params: Record<string, unknown>): SkillInvocation {
  const module = createDefaultSkillCatalog().find((skill) => skill.id === "eat-skill");
  assert.ok(module);
  const action: StrategicAction = {
    id: "eat-parameter-test", kind: "eat_food", params,
    priority: "normal", source: "manual", createdAt: 1
  };
  const [invocation] = module.compile(action, new AgentBlackboard("eat-parameters").snapshot());
  assert.ok(invocation);
  return invocation;
}

test("eat Skill preserves the requested food without forwarding unrelated metadata or mutating input", () => {
  const params = Object.freeze({ itemName: " cooked_salmon ", reason: "recover", extra: true });
  assert.deepEqual(compileEat(params), {
    skill: "interact.eat", args: { itemName: " cooked_salmon " }
  });
  assert.equal(params.itemName, " cooked_salmon ");
});

test("eat Skill keeps automatic food selection when itemName is omitted or undefined", async () => {
  for (const params of [{}, { reason: "recover" }, { itemName: undefined }]) {
    const invocation = compileEat(params);
    assert.deepEqual(invocation, { skill: "interact.eat", args: {} });
    const inputs: EatFoodInput[] = [];
    await executeAgentEatTool({
      eatFood: async (input = {}) => {
        inputs.push(input);
        return { ok: true, detail: "ate 'bread'" };
      }
    }, invocation.args);
    assert.deepEqual(inputs, [{}]);
  }
});

const invalidNames: readonly unknown[] = [null, 42, false, [], {}, "", "   "];
for (const itemName of invalidNames) {
  test(`eat Skill rejects invalid itemName ${JSON.stringify(itemName)} without automatic eating`, async () => {
    const invocation = compileEat({ itemName });
    assert.deepEqual(invocation.args, { itemName });
    let called = false;
    await assert.rejects(executeAgentEatTool({
      eatFood: async () => {
        called = true;
        return { ok: true };
      }
    }, invocation.args), /interact\.eat itemName must be/);
    assert.equal(called, false);
  });
}

test("explicit and legacy food plans retain itemName through translation and Skill compilation", () => {
  const plans: readonly AgentPlan[] = [
    { intent: "execute_skill", directive: { actions: [{ kind: "eat_food", params: { itemName: "cod" } }] } },
    { intent: "execute_skill", steps: [{ tool: "interact.eat", arguments: { itemName: "cod" } }] },
    { intent: "execute_skill", tool: "interact.eat", arguments: { itemName: "cod" } }
  ];
  for (const plan of plans) {
    const translation = buildDirectiveFromPlan("food-plan", "Eat cod.", plan, 1);
    assert.deepEqual(translation.leftoverSteps, []);
    const action = translation.directive?.actions[0];
    assert.equal(action?.kind, "eat_food");
    assert.ok(action);
    assert.deepEqual(compileEat(action.params), { skill: "interact.eat", args: { itemName: "cod" } });
  }
});
