import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPathfinderMovementProfile,
  applySafePathfinderMovementProfile,
  PathfinderMovementSettings
} from "../src/runtime/pathfinder-movement-profile.js";

function destructiveMovements(): PathfinderMovementSettings {
  return {
    canDig: true,
    allow1by1towers: true,
    allowFreeMotion: true,
    allowParkour: true,
    allowSprinting: true,
    scafoldingBlocks: [3, 4],
    maxDropDown: 4,
    placeCost: 1
  };
}

test("safe pathfinder movement cannot dig, build, parkour, or take large drops", () => {
  const movements = destructiveMovements();

  applySafePathfinderMovementProfile(movements);

  assert.equal(movements.canDig, false);
  assert.equal(movements.allow1by1towers, false);
  assert.equal(movements.allowFreeMotion, false);
  assert.equal(movements.allowParkour, false);
  assert.equal(movements.allowSprinting, false);
  assert.deepEqual(movements.scafoldingBlocks, []);
  assert.equal(movements.maxDropDown, 2);
  assert.equal(movements.placeCost, Number.MAX_SAFE_INTEGER);
});

test("mining pathfinder profile also forbids route digging and building", () => {
  const movements = destructiveMovements();

  applyPathfinderMovementProfile(movements, "mining");

  assert.equal(movements.canDig, false);
  assert.equal(movements.allow1by1towers, false);
  assert.deepEqual(movements.scafoldingBlocks, []);
  assert.equal(movements.placeCost, Number.MAX_SAFE_INTEGER);
});
