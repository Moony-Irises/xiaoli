import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { McClientService } from "../src/services/mc-client-service.js";
import { ClientMovementEvent } from "../src/runtime/client-adapter.js";
import { createClientAdapter } from "../src/runtime/client-adapter-factory.js";
import { SafePathError, SafePathFailureReason } from "../src/runtime/mining-approach.js";

interface TestPosition {
  x: number;
  y: number;
  z: number;
  distanceTo(other: TestPosition): number;
  offset(x: number, y: number, z: number): TestPosition;
}

interface AdapterInternals {
  bot: unknown;
  combatHitCounter: number;
}

interface TestPathfinder {
  setMovements(movements: unknown): void;
  setGoal(goal: unknown, dynamic?: boolean): void;
}

interface TestPathUpdate {
  status: "noPath" | "timeout" | "success" | "partial";
  path: Array<{ x: number; y: number; z: number }>;
}

function position(x: number, y: number, z: number): TestPosition {
  return {
    x,
    y,
    z,
    distanceTo(other) {
      return Math.hypot(this.x - other.x, this.y - other.y, this.z - other.z);
    },
    offset(dx, dy, dz) {
      return position(this.x + dx, this.y + dy, this.z + dz);
    }
  };
}

function createAdapterWithBot(
  targetPosition = position(3, 64, 0),
  pathfinder?: TestPathfinder
): {
  adapter: ReturnType<typeof createClientAdapter>;
  controls: Array<{ control: string; enabled: boolean }>;
  attacked: unknown[];
  lookedAt: unknown[];
  emitPathUpdate(update: TestPathUpdate): void;
  pathUpdateListenerCount(): number;
  setTargetPosition(next: TestPosition): void;
} {
  const adapter = createClientAdapter("mineflayer", {
    mcClientService: new McClientService()
  });
  const controls: Array<{ control: string; enabled: boolean }> = [];
  const attacked: unknown[] = [];
  const lookedAt: unknown[] = [];
  const events = new EventEmitter();
  const target = {
    id: 42,
    position: targetPosition,
    type: "mob",
    name: "zombie"
  };
  const bot = {
    entity: {
      id: 1,
      position: position(0, 64, 0)
    },
    entities: { 42: target },
    inventory: { items: () => [] },
    heldItem: null,
    pathfinder,
    __moonySafeMovements: pathfinder ? {} : undefined,
    lookAt: async (targetLook: unknown) => {
      lookedAt.push(targetLook);
    },
    setControlState: (control: string, enabled: boolean) => {
      controls.push({ control, enabled });
    },
    on: events.on.bind(events),
    off: events.off.bind(events),
    attack: (targetAttack: unknown) => {
      attacked.push(targetAttack);
    }
  };
  const internals = adapter as unknown as AdapterInternals;
  internals.bot = bot;
  internals.combatHitCounter = 3;
  return {
    adapter,
    controls,
    attacked,
    lookedAt,
    emitPathUpdate(update) {
      events.emit("path_update", update);
    },
    pathUpdateListenerCount() {
      return events.listenerCount("path_update");
    },
    setTargetPosition(next) {
      target.position = next;
    }
  };
}

test("pursueEntity fails closed when safe pathfinder is unavailable", async () => {
  const { adapter, controls, lookedAt } = createAdapterWithBot();

  await assert.rejects(adapter.pursueEntity({ entityId: 42, stopDistance: 2, sprint: true, jump: true }), (error: unknown) => {
    assert.ok(error instanceof SafePathError);
    assert.equal(error.reason, "pathfinder_unavailable");
    return true;
  });

  assert.equal(lookedAt.length, 0);
  assert.equal(controls.some(({ enabled }) => enabled), false);
});

test("attackEntity attacks only the requested in-range entity", async () => {
  const { adapter, attacked, lookedAt } = createAdapterWithBot();

  const result = await adapter.attackEntity({ entityId: 42, maxDistance: 4.5 });

  assert.equal(result.ok, true);
  assert.match(result.detail ?? "", /id=42/);
  assert.equal(lookedAt.length, 1);
  assert.equal(attacked.length, 1);
  assert.equal((attacked[0] as { id: number }).id, 42);
});

test("moveTo fails closed when safe pathfinder is unavailable", async () => {
  const { adapter, controls, lookedAt } = createAdapterWithBot();

  await assert.rejects(adapter.moveTo({ x: 7, y: 65, z: 0, stopRadius: 2.3 }), (error: unknown) => {
    assert.ok(error instanceof SafePathError);
    assert.equal(error.reason, "pathfinder_unavailable");
    return true;
  });

  assert.equal(lookedAt.length, 0);
  assert.equal(controls.some(({ enabled }) => enabled), false);
});

test("safe pathfinder actions stop movement when assigning a goal fails", async () => {
  const pathfinder: TestPathfinder = {
    setMovements() {},
    setGoal() {
      throw new Error("goal rejected");
    }
  };
  const moveSetup = createAdapterWithBot(position(3, 64, 0), pathfinder);
  const pursueSetup = createAdapterWithBot(position(3, 64, 0), pathfinder);

  await assert.rejects(moveSetup.adapter.moveTo({ x: 7, y: 65, z: 0 }), (error: unknown) => {
    assert.ok(error instanceof SafePathError);
    assert.equal(error.reason, "goal_rejected");
    return true;
  });
  await assert.rejects(pursueSetup.adapter.pursueEntity({ entityId: 42, stopDistance: 2 }), (error: unknown) => {
    assert.ok(error instanceof SafePathError);
    assert.equal(error.reason, "goal_rejected");
    return true;
  });

  assert.equal(moveSetup.controls.some(({ enabled }) => enabled), false);
  assert.equal(pursueSetup.controls.some(({ enabled }) => enabled), false);
});

test("moveTo accepts a complete safe path and keeps one continuous listener", async () => {
  const pathfinder: TestPathfinder = {
    setMovements() {},
    setGoal() {}
  };
  const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);

  const pending = setup.adapter.moveTo({ x: 8, y: 64, z: 0, movementId: "move:test" });
  assert.equal(setup.pathUpdateListenerCount(), 1);
  setup.emitPathUpdate({
    status: "success",
    path: [{ x: 4, y: 64, z: 0 }, { x: 8, y: 64, z: 0 }]
  });

  const result = await pending;
  assert.equal(result.ok, true);
  assert.match(result.detail ?? "", /with pathfinder/);
  assert.equal(setup.pathUpdateListenerCount(), 1);
  await setup.adapter.stopMovement();
  assert.equal(setup.pathUpdateListenerCount(), 0);
});

test("safe movement emits one correlated failure after the initial path succeeds", async () => {
  const cases: Array<{ update: TestPathUpdate; reason: SafePathFailureReason }> = [
    { update: { status: "noPath", path: [] }, reason: "no_path" },
    { update: { status: "timeout", path: [] }, reason: "path_timeout" },
    {
      update: {
        status: "partial",
        path: [{ x: 0, y: 64, z: 13 }, { x: 0, y: 64, z: 26 }]
      },
      reason: "detour_too_long"
    }
  ];

  for (const { update, reason } of cases) {
    const pathfinder: TestPathfinder = {
      setMovements() {},
      setGoal() {}
    };
    const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);
    const events: ClientMovementEvent[] = [];
    setup.adapter.subscribeMovementEvents((event) => events.push(event));
    const pending = setup.adapter.pursueEntity({
      entityId: 42,
      stopDistance: 2,
      movementId: `follow:42:${reason}`
    });
    setup.emitPathUpdate({ status: "success", path: [{ x: 3, y: 64, z: 0 }] });
    await pending;

    setup.emitPathUpdate(update);
    setup.emitPathUpdate(update);

    assert.deepEqual(events, [{
      type: "movement_failed",
      movementId: `follow:42:${reason}`,
      action: "pursue_entity",
      reason,
      detail: `safe path ${reason}: continuous route is unavailable or unsafe`
    }]);
    assert.equal(setup.pathUpdateListenerCount(), 0);
    assert.equal(setup.controls.at(-1)?.enabled, false);
  }
});

test("continuous pursuit reads the current entity position and isolates observer errors", async () => {
  const pathfinder: TestPathfinder = {
    setMovements() {},
    setGoal() {}
  };
  const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);
  const events: ClientMovementEvent[] = [];
  setup.adapter.subscribeMovementEvents(() => {
    throw new Error("observer failed");
  });
  setup.adapter.subscribeMovementEvents((event) => events.push(event));

  const pending = setup.adapter.pursueEntity({ entityId: 42, movementId: "follow:dynamic" });
  setup.emitPathUpdate({ status: "success", path: [{ x: 3, y: 64, z: 0 }] });
  await pending;

  setup.setTargetPosition(position(100, 64, 0));
  setup.emitPathUpdate({ status: "partial", path: [{ x: 30, y: 64, z: 0 }] });
  assert.equal(events.length, 0);
  assert.equal(setup.pathUpdateListenerCount(), 1);

  setup.emitPathUpdate({ status: "noPath", path: [] });
  assert.equal(events.length, 1);
  assert.equal(events[0].movementId, "follow:dynamic");
  assert.equal(setup.pathUpdateListenerCount(), 0);
});

test("safe movement rejects no-path, timeout, and excessive detours", async () => {
  const cases: Array<{ update: TestPathUpdate; reason: SafePathFailureReason }> = [
    { update: { status: "noPath", path: [] }, reason: "no_path" },
    { update: { status: "timeout", path: [] }, reason: "path_timeout" },
    {
      update: {
        status: "success",
        path: [{ x: 0, y: 64, z: 13 }, { x: 0, y: 64, z: 26 }]
      },
      reason: "detour_too_long"
    }
  ];

  for (const { update, reason } of cases) {
    const pathfinder: TestPathfinder = {
      setMovements() {},
      setGoal() {}
    };
    const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);
    const pending = setup.adapter.pursueEntity({ entityId: 42, stopDistance: 2 });

    setup.emitPathUpdate(update);

    await assert.rejects(pending, (error: unknown) => {
      assert.ok(error instanceof SafePathError);
      assert.equal(error.reason, reason);
      return true;
    });
    assert.equal(setup.pathUpdateListenerCount(), 0);
    assert.equal(setup.controls.at(-1)?.enabled, false);
  }
});

test("a new movement goal supersedes the previous initial path listener", async () => {
  const pathfinder: TestPathfinder = {
    setMovements() {},
    setGoal() {}
  };
  const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);

  const first = setup.adapter.moveTo({ x: 8, y: 64, z: 0 });
  assert.equal(setup.pathUpdateListenerCount(), 1);
  const second = setup.adapter.moveTo({ x: 9, y: 64, z: 0 });
  assert.equal(setup.pathUpdateListenerCount(), 1);

  assert.match((await first).detail ?? "", /superseded/);
  setup.emitPathUpdate({ status: "success", path: [{ x: 9, y: 64, z: 0 }] });
  assert.match((await second).detail ?? "", /with pathfinder/);
  assert.equal(setup.pathUpdateListenerCount(), 1);
  await setup.adapter.stopMovement();
  assert.equal(setup.pathUpdateListenerCount(), 0);
});

test("replacing, stopping, and clearing movement silently remove continuous listeners", async () => {
  const pathfinder: TestPathfinder = {
    setMovements() {},
    setGoal() {}
  };
  const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);
  const events: ClientMovementEvent[] = [];
  setup.adapter.subscribeMovementEvents((event) => events.push(event));

  const first = setup.adapter.moveTo({ x: 8, y: 64, z: 0, movementId: "move:first" });
  setup.emitPathUpdate({ status: "success", path: [{ x: 8, y: 64, z: 0 }] });
  await first;
  const second = setup.adapter.moveTo({ x: 9, y: 64, z: 0, movementId: "move:second" });
  assert.equal(setup.pathUpdateListenerCount(), 1);
  setup.emitPathUpdate({ status: "success", path: [{ x: 9, y: 64, z: 0 }] });
  await second;
  assert.deepEqual(events, []);

  await setup.adapter.stopMovement();
  assert.equal(setup.pathUpdateListenerCount(), 0);
  assert.deepEqual(events, []);

  const third = setup.adapter.moveTo({ x: 10, y: 64, z: 0, movementId: "move:third" });
  setup.emitPathUpdate({ status: "success", path: [{ x: 10, y: 64, z: 0 }] });
  await third;
  setup.adapter.clearBotReference();
  assert.equal(setup.pathUpdateListenerCount(), 0);
  assert.deepEqual(events, []);
});

test("a replacement setup failure silently clears the previous continuous listener", async () => {
  let pathfinderUnavailable = false;
  const pathfinder: TestPathfinder = {
    setMovements() {
      if (pathfinderUnavailable) throw new Error("pathfinder unavailable");
    },
    setGoal() {}
  };
  const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);
  const events: ClientMovementEvent[] = [];
  setup.adapter.subscribeMovementEvents((event) => events.push(event));

  const first = setup.adapter.moveTo({ x: 8, y: 64, z: 0, movementId: "move:first" });
  setup.emitPathUpdate({ status: "success", path: [{ x: 8, y: 64, z: 0 }] });
  await first;
  assert.equal(setup.pathUpdateListenerCount(), 1);

  pathfinderUnavailable = true;
  await assert.rejects(
    setup.adapter.moveTo({ x: 9, y: 64, z: 0, movementId: "move:replacement" }),
    (error: unknown) => error instanceof SafePathError && error.reason === "pathfinder_unavailable"
  );
  assert.equal(setup.pathUpdateListenerCount(), 0);
  assert.deepEqual(events, []);
});

test("safe movement validates explicit movement ids", async () => {
  const pathfinder: TestPathfinder = {
    setMovements() {},
    setGoal() {}
  };
  const setup = createAdapterWithBot(position(3, 64, 0), pathfinder);

  await assert.rejects(setup.adapter.moveTo({ x: 8, y: 64, z: 0, movementId: "  " }), /movementId/);
  await assert.rejects(setup.adapter.pursueEntity({ entityId: 42, movementId: "bad\nid" }), /movementId/);
  await assert.rejects(setup.adapter.moveTo({ x: 8, y: 64, z: 0, movementId: "x".repeat(201) }), /movementId/);
});

test("entity actions reject missing, invalid, and out-of-range targets", async () => {
  const { adapter } = createAdapterWithBot(position(8, 64, 0));

  await assert.rejects(adapter.attackEntity({ entityId: 42, maxDistance: 4.5 }), /too far/);
  await assert.rejects(adapter.attackEntity({ entityId: 99 }), /not found nearby/);
  await assert.rejects(adapter.pursueEntity({ entityId: -1 }), /non-negative integer/);
  await assert.rejects(adapter.pursueEntity({ entityId: 42, stopDistance: 0 }), /greater than zero/);
  await assert.rejects(adapter.moveTo({ x: Number.NaN, y: 64, z: 0 }), /finite x\/y\/z/);
  await assert.rejects(adapter.moveTo({ x: 1, y: 64, z: 0, stopRadius: 0 }), /greater than zero/);
});
