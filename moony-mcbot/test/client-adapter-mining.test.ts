import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { McClientService } from "../src/services/mc-client-service.js";
import { createClientAdapter } from "../src/runtime/client-adapter-factory.js";
import type { PathfinderMovementSettings } from "../src/runtime/pathfinder-movement-profile.js";

interface TestPosition {
  x: number;
  y: number;
  z: number;
  offset(x: number, y: number, z: number): TestPosition;
}

interface TestBlock {
  name: string;
  displayName: string;
  type: number;
  boundingBox: string;
  position: TestPosition;
  digTime(toolType: number | null): number;
}

interface AdapterInternals {
  bot: unknown;
}

function position(x: number, y: number, z: number): TestPosition {
  return {
    x,
    y,
    z,
    offset(dx, dy, dz) {
      return position(this.x + dx, this.y + dy, this.z + dz);
    }
  };
}

function safeMovements(): PathfinderMovementSettings {
  return {
    canDig: false,
    allow1by1towers: false,
    allowFreeMotion: false,
    allowParkour: false,
    allowSprinting: false,
    scafoldingBlocks: [],
    maxDropDown: 2,
    placeCost: Number.MAX_SAFE_INTEGER
  };
}

function createMiningAdapter(options: {
  targetX?: number;
  actualName?: string;
  pathStatus?: "noPath" | "timeout" | "success" | "partial";
  targetMissing?: boolean;
  occluded?: boolean;
  canDig?: boolean;
  pathfinderAvailable?: boolean;
} = {}): {
  adapter: ReturnType<typeof createClientAdapter>;
  dug: TestBlock[];
  equipped: string[];
  assignedMovements: PathfinderMovementSettings[];
  clearedGoals: number;
} {
  const adapter = createClientAdapter("mineflayer", { mcClientService: new McClientService() });
  const emitter = new EventEmitter();
  const targetPosition = position(options.targetX ?? 2, 64, 0);
  const block: TestBlock = {
    name: options.actualName ?? "coal_ore",
    displayName: "Coal Ore",
    type: 16,
    boundingBox: "block",
    position: targetPosition,
    digTime(toolType) {
      return toolType === 257 ? 1 : 10;
    }
  };
  const obstruction: TestBlock = {
    ...block,
    name: "stone",
    displayName: "Stone",
    type: 1,
    position: position(1, 65, 0)
  };
  const pickaxe = { name: "iron_pickaxe", type: 257 };
  const dug: TestBlock[] = [];
  const equipped: string[] = [];
  const assignedMovements: PathfinderMovementSettings[] = [];
  let clearedGoals = 0;
  const bot = Object.assign(emitter, {
    entity: {
      position: position(0, 64, 0),
      height: 1.62,
      effects: {},
      onGround: true
    },
    __moonySafeMovements: safeMovements(),
    inventory: { items: () => [pickaxe] },
    pathfinder: options.pathfinderAvailable === false ? undefined : {
      setMovements: (movements: PathfinderMovementSettings) => assignedMovements.push(movements),
      setGoal: (goal: unknown) => {
        if (goal === null) {
          clearedGoals += 1;
          return;
        }
        if (options.pathStatus) {
          queueMicrotask(() => emitter.emit("path_update", { status: options.pathStatus, path: [] }));
        }
      },
      stop: () => {},
      bestHarvestTool: () => pickaxe
    },
    blockAt: (query: TestPosition) => {
      const isTarget = Math.floor(query.x) === Math.floor(targetPosition.x)
        && Math.floor(query.y) === Math.floor(targetPosition.y)
        && Math.floor(query.z) === Math.floor(targetPosition.z);
      if (isTarget) return options.targetMissing ? null : block;
      if (options.occluded && Math.floor(query.x) === 1) return obstruction;
      return null;
    },
    canDigBlock: () => options.canDig ?? true,
    lookAt: async () => {},
    dig: async (target: TestBlock) => {
      dug.push(target);
    },
    equip: async (item: { name: string }) => {
      equipped.push(item.name);
    },
    setControlState: () => {}
  });
  (adapter as unknown as AdapterInternals).bot = bot;
  return {
    adapter,
    dug,
    equipped,
    assignedMovements,
    get clearedGoals() {
      return clearedGoals;
    }
  };
}

test("mineBlock digs only the matching reachable target with the best tool", async () => {
  const setup = createMiningAdapter();

  const result = await setup.adapter.mineBlock({
    target: { name: "coal_ore", position: { x: 2, y: 64, z: 0 } }
  });

  assert.equal(result.ok, true);
  assert.equal(result.outcome, "mined");
  assert.equal(result.equippedTool, "iron_pickaxe");
  assert.deepEqual(setup.equipped, ["iron_pickaxe"]);
  assert.equal(setup.dug.length, 1);
  assert.equal(setup.dug[0]?.name, "coal_ore");
});

test("mineBlock rejects a block that changed before execution", async () => {
  const setup = createMiningAdapter({ actualName: "stone" });

  const result = await setup.adapter.mineBlock({
    target: { name: "coal_ore", position: { x: 2, y: 64, z: 0 } }
  });

  assert.equal(result.ok, false);
  assert.equal(result.outcome, "target_changed");
  assert.equal(setup.dug.length, 0);
});

test("mineBlock reports no-path without enabling destructive movement", async () => {
  const setup = createMiningAdapter({ targetX: 10, pathStatus: "noPath" });

  const result = await setup.adapter.mineBlock({
    target: { name: "coal_ore", position: { x: 10, y: 64, z: 0 } },
    approachTimeoutMs: 1000
  });

  assert.equal(result.ok, false);
  assert.equal(result.outcome, "approach_unreachable");
  assert.equal(result.approachFailureReason, "no_path");
  assert.equal(setup.assignedMovements.length, 1);
  assert.equal(setup.assignedMovements[0]?.canDig, false);
  assert.deepEqual(setup.assignedMovements[0]?.scafoldingBlocks, []);
  assert.ok(setup.clearedGoals >= 1);
  assert.equal(setup.dug.length, 0);
});

test("mineBlock reports target, visibility, reach, and pathfinder failures without digging", async () => {
  const cases = [
    { options: { targetMissing: true }, outcome: "target_missing" },
    { options: { occluded: true }, outcome: "not_visible" },
    { options: { canDig: false }, outcome: "cannot_dig" },
    { options: { targetX: 10, pathfinderAvailable: false }, outcome: "pathfinder_unavailable" }
  ] as const;

  for (const entry of cases) {
    const setup = createMiningAdapter(entry.options);
    const targetX = "targetX" in entry.options ? entry.options.targetX : 2;
    const result = await setup.adapter.mineBlock({
      target: { name: "coal_ore", position: { x: targetX, y: 64, z: 0 } }
    });

    assert.equal(result.ok, false);
    assert.equal(result.outcome, entry.outcome);
    assert.equal(setup.dug.length, 0);
  }
});

test("mineBlock validates destructive action inputs", async () => {
  const { adapter } = createMiningAdapter();

  await assert.rejects(
    adapter.mineBlock({ target: { name: "coal_ore", position: { x: Number.NaN, y: 64, z: 0 } } }),
    /finite x\/y\/z/
  );
  await assert.rejects(
    adapter.mineBlock({ target: { name: "coal_ore", position: { x: 2, y: 64, z: 0 } }, reachDistance: 0 }),
    /reachDistance must be greater than zero/
  );
});
