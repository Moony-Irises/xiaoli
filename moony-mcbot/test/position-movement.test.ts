import assert from "node:assert/strict";
import test from "node:test";
import { decidePositionMovement } from "../src/runtime/position-movement.js";

test("position movement treats the stop radius boundary as arrived", () => {
  const decision = decidePositionMovement(
    { x: 0, y: 64, z: 0 },
    { x: 2.3, y: 64, z: 0 },
    2.3
  );

  assert.equal(decision.status, "arrived");
  assert.equal(decision.distance, 2.3);
  assert.equal(decision.pathfinderSprint, false);
});

test("position movement enables pathfinder sprint only beyond eight horizontal blocks", () => {
  const walkingDistance = decidePositionMovement(
    { x: 0, y: 64, z: 0 },
    { x: 7, y: 65, z: 0 }
  );
  const pathfinderSprint = decidePositionMovement(
    { x: 0, y: 64, z: 0 },
    { x: 9, y: 64.8, z: 0 }
  );

  assert.equal(walkingDistance.status, "move");
  assert.equal(walkingDistance.pathfinderSprint, false);
  assert.equal(pathfinderSprint.pathfinderSprint, true);
});

test("position movement rejects invalid coordinates and stop radii", () => {
  assert.throws(
    () => decidePositionMovement({ x: Number.NaN, y: 64, z: 0 }, { x: 1, y: 64, z: 0 }),
    /Current position requires finite/
  );
  assert.throws(
    () => decidePositionMovement({ x: 0, y: 64, z: 0 }, { x: 1, y: Number.POSITIVE_INFINITY, z: 0 }),
    /Target position requires finite/
  );
  assert.throws(
    () => decidePositionMovement({ x: 0, y: 64, z: 0 }, { x: 1, y: 64, z: 0 }, 0),
    /stopRadius must be greater than zero/
  );
});
