import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSnapshot } from "../src/runtime/client-adapter.js";
import {
  decideRetaliationTick,
  resolveRetaliationTarget,
  selectLikelyRetaliationAttacker,
  type RetaliationTickConfig
} from "../src/runtime/self-guard-retaliation.js";

function player(
  username: string,
  position: PlayerSnapshot["position"],
  distance?: number
): PlayerSnapshot {
  return { username, position, distance };
}

const retaliationTickConfig: Readonly<RetaliationTickConfig> = {
  maxChaseMs: 60_000,
  approachDistance: 3,
  attackDistance: 4.5,
  attackCooldownMs: 600
};

test("self-guard retaliation selects the nearest player by exact positions", () => {
  const farther = player("Farther", { x: 3, y: 64, z: 0 }, 1);
  const nearer = player("Nearer", { x: 1.25, y: 64, z: 0 }, 99);

  const selected = selectLikelyRetaliationAttacker({
    players: [farther, nearer],
    selfUsername: "XiaoLi",
    selfPosition: { x: 0, y: 64, z: 0 },
    maxDistance: 16
  });

  assert.deepEqual(selected, {
    username: "Nearer",
    position: { x: 1.25, y: 64, z: 0 },
    distance: 1.25
  });
});

test("self-guard retaliation includes the distance boundary and preserves tie order", () => {
  const first = player("First", { x: 16, y: 64, z: 0 });
  const second = player("Second", { x: -16, y: 64, z: 0 });

  assert.deepEqual(
    selectLikelyRetaliationAttacker({
      players: [first, second],
      selfUsername: "XiaoLi",
      selfPosition: { x: 0, y: 64, z: 0 },
      maxDistance: 16
    }),
    {
      username: "First",
      position: { x: 16, y: 64, z: 0 },
      distance: 16
    }
  );
});

test("self-guard retaliation excludes self and players beyond the exact radius", () => {
  const selected = selectLikelyRetaliationAttacker({
    players: [
      player("XiaoLi", { x: 0.5, y: 64, z: 0 }),
      player("Outside", { x: 16.004, y: 64, z: 0 }, 16),
      player("Inside", { x: 8, y: 64, z: 0 })
    ],
    selfUsername: "XiaoLi",
    selfPosition: { x: 0, y: 64, z: 0 },
    maxDistance: 16
  });

  assert.equal(selected?.username, "Inside");
});

test("self-guard retaliation fails closed for malformed snapshots", () => {
  const players: PlayerSnapshot[] = [
    player("Missing", undefined),
    player("Invalid", { x: Number.NaN, y: 64, z: 0 }),
    player("", { x: 1, y: 64, z: 0 })
  ];

  assert.equal(
    selectLikelyRetaliationAttacker({
      players,
      selfUsername: "XiaoLi",
      selfPosition: { x: 0, y: 64, z: 0 },
      maxDistance: 16
    }),
    null
  );
  assert.equal(
    selectLikelyRetaliationAttacker({
      players: [player("Judy", { x: 1, y: 64, z: 0 })],
      selfUsername: "XiaoLi",
      selfPosition: { x: Number.POSITIVE_INFINITY, y: 64, z: 0 },
      maxDistance: 16
    }),
    null
  );
});

test("self-guard retaliation rejects invalid maximum distances", () => {
  const input = {
    players: [] as PlayerSnapshot[],
    selfUsername: "XiaoLi",
    selfPosition: { x: 0, y: 64, z: 0 }
  };

  assert.throws(
    () => selectLikelyRetaliationAttacker({ ...input, maxDistance: -1 }),
    /finite non-negative/
  );
  assert.throws(
    () => selectLikelyRetaliationAttacker({ ...input, maxDistance: Number.POSITIVE_INFINITY }),
    /finite non-negative/
  );
});

test("self-guard retaliation resolves the expected target using exact positions", () => {
  const target = resolveRetaliationTarget({
    targetUsername: "Attacker",
    player: {
      username: "Attacker",
      entityId: 42,
      uuid: "attacker-uuid",
      distance: 1,
      position: { x: 18, y: 67, z: 4 }
    },
    selfPosition: { x: 6, y: 63, z: 1 }
  });

  assert.deepEqual(target, {
    username: "Attacker",
    entityId: 42,
    uuid: "attacker-uuid",
    distance: 13,
    position: { x: 18, y: 67, z: 4 }
  });
});

test("self-guard retaliation target resolution preserves targets beyond attack range", () => {
  const target = resolveRetaliationTarget({
    targetUsername: "Attacker",
    player: player("Attacker", { x: 40, y: 64, z: 0 }, 4),
    selfPosition: { x: 0, y: 64, z: 0 }
  });

  assert.equal(target?.distance, 40);
});

test("self-guard retaliation target resolution requires the exact expected username", () => {
  const selfPosition = { x: 0, y: 64, z: 0 };

  assert.equal(
    resolveRetaliationTarget({
      targetUsername: "Attacker",
      player: player("Other", { x: 1, y: 64, z: 0 }),
      selfPosition
    }),
    null
  );
  assert.equal(
    resolveRetaliationTarget({
      targetUsername: "   ",
      player: player("   ", { x: 1, y: 64, z: 0 }),
      selfPosition
    }),
    null
  );
});

test("self-guard retaliation target resolution fails closed for missing or malformed positions", () => {
  const validPlayer = player("Attacker", { x: 1, y: 64, z: 0 });

  assert.equal(
    resolveRetaliationTarget({
      targetUsername: "Attacker",
      player: null,
      selfPosition: { x: 0, y: 64, z: 0 }
    }),
    null
  );
  assert.equal(
    resolveRetaliationTarget({
      targetUsername: "Attacker",
      player: player("Attacker", { x: Number.NaN, y: 64, z: 0 }),
      selfPosition: { x: 0, y: 64, z: 0 }
    }),
    null
  );
  assert.equal(
    resolveRetaliationTarget({
      targetUsername: "Attacker",
      player: validPlayer,
      selfPosition: undefined
    }),
    null
  );
});

test("self-guard retaliation tick times out at the boundary before checking the target", () => {
  const session = { startedAt: 1000, lastAttackAt: 0 };

  assert.deepEqual(
    decideRetaliationTick(session, {}, 61_000, retaliationTickConfig),
    {
      status: "timed_out",
      movement: "stop",
      shouldAttack: false
    }
  );
  assert.equal(
    decideRetaliationTick(session, {}, 60_999, retaliationTickConfig).status,
    "target_unavailable"
  );
});

test("self-guard retaliation tick fails closed for invalid target distances", () => {
  const session = { startedAt: 1000, lastAttackAt: 1000 };

  for (const targetDistance of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    assert.deepEqual(
      decideRetaliationTick(session, { targetDistance }, 2000, retaliationTickConfig),
      {
        status: "target_unavailable",
        movement: "stop",
        shouldAttack: false
      }
    );
  }
});

test("self-guard retaliation tick preserves the inclusive approach boundary", () => {
  const session = { startedAt: 1000, lastAttackAt: 1900 };
  const holding = decideRetaliationTick(
    session,
    { targetDistance: 3 },
    2000,
    retaliationTickConfig
  );
  const approaching = decideRetaliationTick(
    session,
    { targetDistance: 3.001 },
    2000,
    retaliationTickConfig
  );

  assert.equal(holding.status, "active");
  assert.equal(holding.movement, "hold");
  assert.equal(approaching.status, "active");
  assert.equal(approaching.movement, "approach");
});

test("self-guard retaliation tick preserves attack range and cooldown boundaries", () => {
  const readySession = { startedAt: 1000, lastAttackAt: 1400 };
  const ready = decideRetaliationTick(
    readySession,
    { targetDistance: 4.5 },
    2000,
    retaliationTickConfig
  );
  const tooFar = decideRetaliationTick(
    readySession,
    { targetDistance: 4.501 },
    2000,
    retaliationTickConfig
  );
  const coolingDown = decideRetaliationTick(
    { startedAt: 1000, lastAttackAt: 1401 },
    { targetDistance: 4.5 },
    2000,
    retaliationTickConfig
  );

  assert.equal(ready.status, "active");
  assert.equal(ready.shouldAttack, true);
  assert.equal(tooFar.shouldAttack, false);
  assert.equal(coolingDown.shouldAttack, false);
});

test("self-guard retaliation tick rejects invalid timing and configuration", () => {
  const session = { startedAt: 1000, lastAttackAt: 1000 };
  const observation = { targetDistance: 2 };

  assert.throws(
    () => decideRetaliationTick(session, observation, Number.NaN, retaliationTickConfig),
    /timestamp/i
  );
  assert.throws(
    () => decideRetaliationTick({ ...session, startedAt: -1 }, observation, 2000, retaliationTickConfig),
    /timestamp/i
  );

  for (const config of [
    { ...retaliationTickConfig, maxChaseMs: 0 },
    { ...retaliationTickConfig, approachDistance: -1 },
    { ...retaliationTickConfig, attackDistance: Number.POSITIVE_INFINITY },
    { ...retaliationTickConfig, attackCooldownMs: -1 }
  ]) {
    assert.throws(
      () => decideRetaliationTick(session, observation, 2000, config),
      /configuration/i
    );
  }
});
