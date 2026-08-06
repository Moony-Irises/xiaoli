import assert from "node:assert/strict";
import test from "node:test";
import {
  decideDuelTick,
  DuelSessionState,
  findChallengeTargetSnapshot
} from "../src/runtime/duel-session.js";

function session(overrides: Partial<DuelSessionState> = {}): DuelSessionState {
  return {
    targetId: 7,
    targetName: "warden",
    requester: "Judy",
    startedAt: 1000,
    lastAttackAt: 0,
    lastSeenAt: 1000,
    ...overrides
  };
}

test("findChallengeTargetSnapshot resolves Chinese aliases and chooses the nearest non-player", () => {
  const target = findChallengeTargetSnapshot([
    { entityId: 1, name: "warden", type: "mob", distance: 9 },
    { entityId: 2, name: "warden", type: "mob", distance: 4 },
    { entityId: 3, name: "warden", type: "player", distance: 2 }
  ], "监守者", 16);

  assert.equal(target?.entityId, 2);
});

test("findChallengeTargetSnapshot rejects mismatched and out-of-range entities", () => {
  assert.equal(findChallengeTargetSnapshot([
    { entityId: 1, name: "zombie", type: "mob", distance: 4 },
    { entityId: 2, name: "warden", type: "mob", distance: 17 }
  ], "监守者", 16), null);
});

test("decideDuelTick waits for a briefly missing target and cancels after timeout", () => {
  const waiting = decideDuelTick(session(), { selfHealth: 20, targetVisible: false }, 3500);
  const cancelled = decideDuelTick(session(), { selfHealth: 20, targetVisible: false }, 3501);

  assert.equal(waiting.outcome, "continue");
  assert.equal(cancelled.outcome, "cancelled");
  assert.match(cancelled.detail, /lost sight/);
});

test("decideDuelTick fails immediately when self health reaches zero", () => {
  const decision = decideDuelTick(session(), { selfHealth: 0, targetVisible: true, targetDistance: 2 }, 2000);

  assert.equal(decision.outcome, "failed");
  assert.equal(decision.shouldAttack, false);
});

test("decideDuelTick separates approach distance from attack distance and cooldown", () => {
  const approachingAndAttacking = decideDuelTick(
    session({ lastAttackAt: 1000 }),
    { selfHealth: 20, targetVisible: true, targetDistance: 4 },
    1650
  );
  const holdingOnCooldown = decideDuelTick(
    session({ lastAttackAt: 1500 }),
    { selfHealth: 20, targetVisible: true, targetDistance: 2.5 },
    2000
  );

  assert.equal(approachingAndAttacking.movement, "approach");
  assert.equal(approachingAndAttacking.shouldAttack, true);
  assert.equal(approachingAndAttacking.nextSession.lastAttackAt, 1650);
  assert.equal(holdingOnCooldown.movement, "hold");
  assert.equal(holdingOnCooldown.shouldAttack, false);
  assert.equal(holdingOnCooldown.nextSession.lastAttackAt, 1500);
});
