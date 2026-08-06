import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSnapshot } from "../src/runtime/client-adapter.js";
import { decideIdleFollowAction } from "../src/runtime/idle-follow-policy.js";

const current = { x: 0, y: 64, z: 0 };

function ownerAt(x: number, y = 64, z = 0): PlayerSnapshot {
  return {
    username: "Judy",
    position: { x, y, z }
  };
}

test("idle follow waits when the visible owner is within the trigger distance", () => {
  assert.deepEqual(decideIdleFollowAction(current, ownerAt(4.5), null), {
    action: "none",
    reason: "owner_nearby"
  });
});

test("idle follow starts following beyond 4.5 blocks and sprints beyond 8 blocks", () => {
  assert.deepEqual(decideIdleFollowAction(current, ownerAt(4.51), null), {
    action: "follow_owner",
    distance: 4.51,
    sprint: false
  });
  assert.deepEqual(decideIdleFollowAction(current, ownerAt(8.01), null), {
    action: "follow_owner",
    distance: 8.01,
    sprint: true
  });
});

test("idle follow returns to a remembered place only when the owner is unavailable", () => {
  const fallback = {
    placeId: "home",
    label: "家",
    x: 6,
    y: 64,
    z: 0
  };

  assert.deepEqual(decideIdleFollowAction(current, null, fallback), {
    action: "return_to_place",
    distance: 6,
    target: fallback
  });
  assert.deepEqual(decideIdleFollowAction(current, ownerAt(6), fallback), {
    action: "follow_owner",
    distance: 6,
    sprint: false
  });
});

test("idle follow stays idle at a nearby fallback or when no fallback exists", () => {
  assert.deepEqual(
    decideIdleFollowAction(current, null, {
      placeId: "home",
      label: "家",
      x: 3.5,
      y: 64,
      z: 0
    }),
    {
      action: "none",
      reason: "already_at_fallback"
    }
  );
  assert.deepEqual(decideIdleFollowAction(current, null, null), {
    action: "none",
    reason: "no_fallback"
  });
});

test("idle follow treats a player snapshot without a valid position as unavailable", () => {
  const ownerWithoutPosition: PlayerSnapshot = { username: "Judy" };
  const ownerWithInvalidPosition: PlayerSnapshot = {
    username: "Judy",
    position: { x: Number.NaN, y: 64, z: 0 }
  };
  const fallback = {
    placeId: "base",
    label: "基地",
    x: 5,
    y: 64,
    z: 0
  };

  assert.equal(decideIdleFollowAction(current, ownerWithoutPosition, fallback).action, "return_to_place");
  assert.equal(decideIdleFollowAction(current, ownerWithInvalidPosition, fallback).action, "return_to_place");
});

test("idle follow rejects invalid current coordinates", () => {
  assert.throws(
    () => decideIdleFollowAction({ x: Number.POSITIVE_INFINITY, y: 64, z: 0 }, null, null),
    /Current position requires finite/
  );
});
