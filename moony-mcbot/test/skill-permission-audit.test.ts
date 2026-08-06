import assert from "node:assert/strict";
import test from "node:test";
import { AgentBlackboard } from "../src/agent/blackboard.js";
import {
  auditSkillCatalogToolPermissions,
  createDefaultSkillCatalog
} from "../src/agent/skill-catalog.js";
import { createDefaultReactiveRules, runReactiveRules } from "../src/agent/reactive-rules.js";
import type { StrategicAction } from "../src/agent/types.js";
import { getDefaultAgentToolIds } from "../src/catalog/tool-catalog.js";

function action(
  kind: StrategicAction["kind"],
  params: Record<string, unknown> = {}
): StrategicAction {
  return {
    id: `audit-${kind}`,
    kind,
    params,
    source: "manual",
    priority: "normal",
    createdAt: 1
  };
}

const COMPILATION_FIXTURES: readonly StrategicAction[] = [
  action("follow_player", { playerName: "Judy" }),
  action("attack_target", { targetName: "Enemy" }),
  action("challenge_entity", { targetText: "zombie" }),
  action("stop_follow"),
  action("move_to_position", { x: 1, y: 64, z: 2 }),
  action("eat_food"),
  action("prepare_battle"),
  action("request_teleport_to_player", { playerName: "Judy" }),
  action("equip_category", { category: "pickaxe" }),
  action("organize_inventory"),
  action("drop_item", { slot: 1 }),
  action("drop_item", { category: "food" }),
  action("drop_item"),
  action("open_door"),
  action("wander_area"),
  action("speak", { text: "hello" }),
  action("socialize", { yaw: 0, pitch: 0 }),
  action("socialize"),
  action("observe_target", { yaw: 0, pitch: 0 }),
  action("observe_target"),
  action("mine_visible", { blockName: "coal_ore" })
];

test("social Skill observes nearby context when target angles are unavailable", () => {
  const catalog = createDefaultSkillCatalog();
  const socialSkill = catalog.find((module) => module.id === "social-skill");
  assert.ok(socialSkill);
  const state = new AgentBlackboard("social-skill-fallback").snapshot();

  assert.deepEqual(
    socialSkill.compile(action("socialize"), state),
    [{ skill: "observe.nearbyPlayers", args: { radius: 32 } }]
  );
  assert.deepEqual(
    socialSkill.compile(action("observe_target"), state),
    [{ skill: "observe.nearbyEntities", args: { radius: 24 } }]
  );
});

test("social Skill only compiles player.look from complete finite angles", () => {
  const catalog = createDefaultSkillCatalog();
  const socialSkill = catalog.find((module) => module.id === "social-skill");
  assert.ok(socialSkill);
  const state = new AgentBlackboard("social-skill-angles").snapshot();

  assert.deepEqual(
    socialSkill.compile(action("observe_target", { yaw: 0, pitch: -0.25 }), state),
    [{ skill: "player.look", args: { yaw: 0, pitch: -0.25 } }]
  );
  assert.deepEqual(
    socialSkill.compile(action("observe_target", { yaw: 1 }), state),
    [{ skill: "observe.nearbyEntities", args: { radius: 24 } }]
  );
  assert.deepEqual(
    socialSkill.compile(action("socialize", { yaw: Number.NaN, pitch: Number.POSITIVE_INFINITY }), state),
    [{ skill: "observe.nearbyPlayers", args: { radius: 32 } }]
  );
});

test("deadline recovery compiles to observation without inventing look angles", () => {
  const state = new AgentBlackboard("deadline-recovery").snapshot();
  const [recoveryAction] = runReactiveRules(
    createDefaultReactiveRules(),
    {
      id: "deadline-event",
      type: "task_timeout",
      priority: "high",
      createdAt: 1,
      payload: { label: "follow timed out" }
    },
    state
  );
  assert.ok(recoveryAction);
  assert.equal(recoveryAction.kind, "observe_target");

  const socialSkill = createDefaultSkillCatalog().find((module) => module.id === "social-skill");
  assert.ok(socialSkill);
  assert.deepEqual(
    socialSkill.compile(recoveryAction, state),
    [{ skill: "observe.nearbyEntities", args: { radius: 24 } }]
  );
});

test("wander Skill keeps invalid planner value types for dispatcher validation", () => {
  const wanderSkill = createDefaultSkillCatalog().find((module) => module.id === "wander-skill");
  assert.ok(wanderSkill);
  const state = new AgentBlackboard("wander-skill-types").snapshot();

  assert.deepEqual(
    wanderSkill.compile(
      action("wander_area", { durationMs: "2000", sprint: "false", jump: 1 }),
      state
    ),
    [
      {
        skill: "movement.walk",
        args: { durationMs: "2000", sprint: "false", jump: 1 }
      }
    ]
  );
  assert.deepEqual(
    wanderSkill.compile(
      action("wander_area", { durationMs: null, sprint: null, jump: null }),
      state
    ),
    [
      {
        skill: "movement.walk",
        args: { durationMs: null, sprint: null, jump: null }
      }
    ]
  );
});

test("default Skill Catalog reports the four existing allowlist gaps", () => {
  const gaps = auditSkillCatalogToolPermissions(
    createDefaultSkillCatalog(),
    getDefaultAgentToolIds()
  );

  assert.deepEqual(
    gaps.map(({ moduleId, tool, supportedActions }) => ({ moduleId, tool, supportedActions })),
    [
      {
        moduleId: "combat-skill",
        tool: "interact.attackPlayer",
        supportedActions: ["attack_target"]
      },
      {
        moduleId: "eat-skill",
        tool: "interact.eat",
        supportedActions: ["eat_food"]
      },
      {
        moduleId: "wander-skill",
        tool: "movement.walk",
        supportedActions: ["wander_area"]
      },
      {
        moduleId: "social-skill",
        tool: "player.look",
        supportedActions: ["socialize", "speak", "observe_target"]
      }
    ]
  );
});

test("every default Skill compilation branch stays within declared tool dependencies", () => {
  const catalog = createDefaultSkillCatalog();
  const state = new AgentBlackboard("skill-audit").snapshot();

  for (const module of catalog) {
    const fixtures = COMPILATION_FIXTURES.filter((candidate) =>
      module.supportedActions.includes(candidate.kind)
    );
    assert.ok(fixtures.length > 0, `${module.id} has no compilation fixture`);

    const compiledTools = new Set<string>();
    for (const fixture of fixtures) {
      for (const invocation of module.compile(fixture, state)) {
        assert.ok(
          module.toolDependencies.includes(invocation.skill),
          `${module.id} compiled undeclared tool '${invocation.skill}'`
        );
        compiledTools.add(invocation.skill);
      }
    }

    assert.deepEqual(
      [...compiledTools].sort(),
      [...new Set(module.toolDependencies)].sort(),
      `${module.id} declares a tool dependency not covered by its compilation fixtures`
    );
  }
});

test("permission audit clears only when all declared dependencies are allowed", () => {
  const allowedTools = [
    ...getDefaultAgentToolIds(),
    "interact.attackPlayer",
    "interact.eat",
    "movement.walk",
    "player.look"
  ];

  assert.deepEqual(
    auditSkillCatalogToolPermissions(createDefaultSkillCatalog(), allowedTools),
    []
  );
});
