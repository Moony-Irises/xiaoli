import assert from "node:assert/strict";
import test from "node:test";
import {
  assessMiningPathUpdate,
  calculateRouteDistance,
  getMaxMiningRouteDistance
} from "../src/runtime/mining-approach.js";

test("mining approach accepts a reasonable safe route", () => {
  const assessment = assessMiningPathUpdate(
    { x: 0, y: 64, z: 0 },
    { x: 10, y: 64, z: 0 },
    "success",
    [
      { x: 4, y: 64, z: 0 },
      { x: 8, y: 64, z: 1 }
    ]
  );

  assert.equal(assessment.outcome, "continue");
  assert.equal(assessment.reason, undefined);
  assert.equal(assessment.maxRouteDistance, 25);
  assert.ok(assessment.routeDistance < assessment.maxRouteDistance);
});

test("mining approach rejects no-path, path timeout, and excessive detours", () => {
  const current = { x: 0, y: 64, z: 0 };
  const target = { x: 8, y: 64, z: 0 };

  assert.equal(assessMiningPathUpdate(current, target, "noPath", []).reason, "no_path");
  assert.equal(assessMiningPathUpdate(current, target, "timeout", []).reason, "path_timeout");
  assert.equal(assessMiningPathUpdate(current, target, "partial", [
    { x: 0, y: 64, z: 13 },
    { x: 0, y: 64, z: 26 }
  ]).reason, "detour_too_long");
});

test("mining route helpers preserve thresholds and reject invalid data", () => {
  assert.equal(getMaxMiningRouteDistance(4), 24);
  assert.equal(getMaxMiningRouteDistance(20), 50);
  assert.equal(calculateRouteDistance(
    { x: 0, y: 0, z: 0 },
    [{ x: 3, y: 4, z: 0 }, { x: 3, y: 4, z: 12 }]
  ), 17);
  assert.throws(() => getMaxMiningRouteDistance(Number.NaN), /non-negative finite/);
  assert.throws(
    () => calculateRouteDistance({ x: 0, y: 0, z: 0 }, [{ x: Number.NaN, y: 0, z: 0 }]),
    /Route node requires finite/
  );
});
