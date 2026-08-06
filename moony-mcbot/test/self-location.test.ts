import assert from "node:assert/strict";
import test from "node:test";
import type { SelfStateSnapshot } from "../src/runtime/client-adapter.js";
import {
  isDimensionCompatible,
  requireSelfLocation
} from "../src/runtime/self-location.js";

test("requireSelfLocation validates coordinates and normalizes output", () => {
  const selfState: SelfStateSnapshot = {
    position: { x: 1.23456, y: 64, z: -2.34567 },
    dimension: "  overworld  "
  };

  assert.deepEqual(requireSelfLocation(selfState, "bot-1"), {
    position: { x: 1.23456, y: 64, z: -2.34567 },
    roundedPosition: { x: 1.235, y: 64, z: -2.346 },
    dimension: "overworld"
  });
});

test("requireSelfLocation omits an empty dimension", () => {
  assert.deepEqual(
    requireSelfLocation({ position: { x: 0, y: 0, z: 0 }, dimension: "  " }, "bot-1"),
    {
      position: { x: 0, y: 0, z: 0 },
      roundedPosition: { x: 0, y: 0, z: 0 },
      dimension: undefined
    }
  );
});

test("requireSelfLocation rejects missing runtime snapshots and positions", () => {
  assert.throws(() => requireSelfLocation(null, "bot-1"), /Bot 'bot-1' self state is unavailable/);
  assert.throws(
    () => requireSelfLocation({ health: 20 }, "bot-1"),
    /Bot 'bot-1' position is unavailable/
  );
});

test("requireSelfLocation rejects every non-finite coordinate", () => {
  for (const position of [
    { x: Number.NaN, y: 64, z: 0 },
    { x: 0, y: Number.POSITIVE_INFINITY, z: 0 },
    { x: 0, y: 64, z: Number.NEGATIVE_INFINITY }
  ]) {
    assert.throws(
      () => requireSelfLocation({ position }, "bot-1"),
      /Bot 'bot-1' position requires finite x\/y\/z coordinates/
    );
  }
});

test("isDimensionCompatible allows unknown dimensions and rejects known mismatches", () => {
  assert.equal(isDimensionCompatible(undefined, "overworld"), true);
  assert.equal(isDimensionCompatible("overworld", undefined), true);
  assert.equal(isDimensionCompatible("overworld", "overworld"), true);
  assert.equal(isDimensionCompatible("the_nether", "overworld"), false);
});
