import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlannerContextProjection,
  buildPlannerMemorySummary
} from "../src/runtime/planner-context-projection.js";

const FORBIDDEN_KEYS = new Set([
  "botId",
  "position",
  "x",
  "y",
  "z",
  "entityId",
  "id",
  "taskId",
  "timestamp",
  "createdAt",
  "updatedAt",
  "payload",
  "params",
  "notes",
  "slot"
]);

function collectForbiddenKeys(value: unknown, path = "root", matches: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectForbiddenKeys(entry, `${path}[${index}]`, matches));
    return matches;
  }
  if (!value || typeof value !== "object") return matches;

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) matches.push(`${path}.${key}`);
    collectForbiddenKeys(child, `${path}.${key}`, matches);
  }
  return matches;
}

function createSnapshot(): Record<string, unknown> {
  return {
    botId: "private-bot-id",
    timestamp: "2026-07-29T00:00:00.000Z",
    mode: "auto",
    runtimeState: "task_running",
    selfState: {
      position: { x: 100, y: 64, z: -20 },
      rotation: { yaw: 1, pitch: 2 },
      movement: {
        onGround: true,
        velocity: { x: 0.1, y: 0, z: 0.2 },
        isMoving: true,
        isFollowing: false,
        isPathfinding: true
      },
      vitals: { health: 18, food: 12, oxygenLevel: 20, isHurt: true, isHungry: true, isCritical: false },
      equipment: {
        heldItem: { name: "iron_pickaxe", count: 1, slot: 36 },
        armor: { head: "iron_helmet", torso: null, legs: null, feet: null }
      },
      inventory: {
        freeSlots: 8,
        bestFood: "cooked_salmon",
        foodCount: 4,
        itemSummary: [{ name: "coal", count: 12 }],
        toolSummary: { hasSword: true, hasAxe: false, hasPickaxe: true }
      },
      currentActivity: { type: "mine_visible", detail: "moving to 100,64,-20" }
    },
    localWorld: {
      dimension: "overworld",
      time: { isDay: true, isNight: false, isRaining: false },
      terrain: { feetBlock: "stone", inSightBlock: "coal_ore", hazards: [] },
      visibleBlocks: Array.from({ length: 12 }, (_, index) => ({
        name: index % 2 === 0 ? "coal_ore" : "iron_ore",
        position: { x: 100 + index, y: 64, z: -20 },
        distance: index + 1,
        visible: true,
        interactable: false,
        hazardNear: false
      })),
      focus: {
        look: { yaw: 1, pitch: 2 },
        focusType: "block",
        block: { name: "coal_ore", position: { x: 101, y: 64, z: -20 }, distance: 2 },
        entity: null
      },
      salient: {
        nearbyPlayers: [{ entityId: 1, username: "Judy", relation: "owner", distance: 3, position: { x: 1, y: 2, z: 3 } }],
        interestingEntities: [{ entityId: 2, name: "creeper", distance: 5, position: { x: 4, y: 5, z: 6 } }],
        interactableBlocks: [{ name: "chest", distance: 4, position: { x: 7, y: 8, z: 9 } }]
      }
    },
    entities: Array.from({ length: 20 }, (_, index) => ({
      entityId: index,
      category: index < 8 ? "player" : "hostile_mob",
      type: index < 8 ? "player" : "mob",
      name: index < 8 ? `player-${index}` : `mob-${index}`,
      displayName: null,
      distance: index + 1,
      position: { x: index, y: 64, z: index },
      relation: index === 0 ? "owner" : index < 8 ? "whitelist" : "hostile",
      threatLevel: index < 8 ? 0 : 2,
      isVisible: true
    })),
    events: Array.from({ length: 10 }, (_, index) => ({
      id: `event-${index}`,
      timestamp: `2026-07-29T00:00:${String(index).padStart(2, "0")}.000Z`,
      type: `event_type_${index}`,
      priority: index % 2 === 0 ? "normal" : "high",
      payload: { detail: `private event ${index}`, x: index }
    })),
    taskContext: {
      activeTask: {
        taskId: "private-task-id",
        type: "mine_visible",
        status: "running",
        source: "agent",
        goal: "mine coal",
        params: { position: { x: 100, y: 64, z: -20 }, targetId: 2 },
        createdAt: "private",
        updatedAt: "private",
        detail: "searching for coal",
        lastError: ""
      },
      subTask: { type: "move", status: "running", detail: "approaching target" },
      risk: { level: "normal", reasons: ["hostile nearby"] }
    },
    memorySummary: {
      owner: "Judy",
      whitelistPlayers: ["Judy", "Alice"],
      strategicGoal: {
        goal: "collect coal",
        rationale: "need fuel",
        source: "manual",
        milestones: ["find coal", "mine coal"],
        currentMilestoneIndex: 1,
        createdAt: 1,
        updatedAt: 2,
        lastFailureEventId: "private-event-id",
        failureCount: 1
      },
      memory: {
        playerProfiles: [{ playerName: "Judy", alias: "茉莉", relation: "owner", tags: ["trusted"], notes: "private note" }],
        places: [{ label: "家", x: 10, y: 65, z: 20, dimension: "overworld", tags: ["home"], notes: "private place" }],
        taskHistory: [{ taskType: "mine_visible", status: "finished", goal: "mine iron", detail: "private detail" }]
      }
    }
  };
}

test("planner context projection keeps decision summaries and strips private runtime fields", () => {
  const snapshot = createSnapshot();
  const before = JSON.stringify(snapshot);
  const projection = buildPlannerContextProjection(snapshot);

  assert.equal(projection.mode, "auto");
  assert.equal(projection.runtimeState, "task_running");
  assert.equal(projection.self.vitals.health, 18);
  assert.deepEqual(projection.self.heldItem, { name: "iron_pickaxe", count: 1 });
  assert.equal(projection.world.visibleBlocks.length, 8);
  assert.equal(projection.nearbyPlayers.length, 6);
  assert.equal(projection.nearbyEntities.length, 10);
  assert.equal(projection.recentEvents.length, 8);
  assert.deepEqual(projection.recentEvents[0], { type: "event_type_2", priority: "normal" });
  assert.equal(projection.task.activeTask?.goal, "mine coal");
  assert.equal(projection.strategicGoal?.goal, "collect coal");
  assert.deepEqual(collectForbiddenKeys(projection), []);
  assert.equal(JSON.stringify(snapshot), before);
});

test("planner memory summary omits coordinates and free-form notes", () => {
  const summary = buildPlannerMemorySummary(createSnapshot());

  assert.match(summary, /Judy/);
  assert.match(summary, /alias=茉莉/);
  assert.match(summary, /家/);
  assert.match(summary, /dimension=overworld/);
  assert.match(summary, /mine_visible:finished:mine iron/);
  assert.doesNotMatch(summary, /private note|private place|private detail/);
  assert.doesNotMatch(summary, /10[,)]|65[,)]|20[,)]|@\(/);
});

test("planner context projection fails closed for malformed optional sections", () => {
  const projection = buildPlannerContextProjection({
    mode: "assist",
    selfState: null,
    localWorld: { visibleBlocks: "not-an-array" },
    entities: [{ category: "player", name: "valid" }, null, "invalid"],
    events: "not-an-array",
    taskContext: null,
    memorySummary: null
  });

  assert.equal(projection.mode, "assist");
  assert.equal(projection.runtimeState, null);
  assert.deepEqual(projection.world.visibleBlocks, []);
  assert.equal(projection.nearbyPlayers.length, 1);
  assert.deepEqual(projection.nearbyEntities, []);
  assert.deepEqual(projection.recentEvents, []);
  assert.equal(projection.task.activeTask, null);
  assert.equal(projection.strategicGoal, null);
});
