import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSelfGuardEnvironmentTransitions,
  readSelfGuardEnvironment
} from "../src/runtime/self-guard-environment.js";

test("self-guard environment reads Mineflayer day and rain flags", () => {
  assert.deepEqual(
    readSelfGuardEnvironment({
      time: { isDay: true },
      isRaining: false
    }),
    { isDay: true, isRaining: false }
  );
});

test("self-guard environment preserves truthy compatibility and missing defaults", () => {
  assert.deepEqual(
    readSelfGuardEnvironment({
      time: { isDay: 1 },
      isRaining: "yes"
    }),
    { isDay: true, isRaining: true }
  );
  assert.deepEqual(readSelfGuardEnvironment(null), { isDay: false, isRaining: false });
  assert.deepEqual(
    readSelfGuardEnvironment({ time: "invalid", isRaining: 0 }),
    { isDay: false, isRaining: false }
  );
});

test("self-guard environment suppresses transitions on the first observation", () => {
  assert.deepEqual(
    detectSelfGuardEnvironmentTransitions(undefined, {
      isDay: false,
      isRaining: true
    }),
    { nightStarted: false, rainStarted: false }
  );
});

test("self-guard environment reports day-to-night and dry-to-rain transitions", () => {
  assert.deepEqual(
    detectSelfGuardEnvironmentTransitions(
      { isDay: true, isRaining: false },
      { isDay: false, isRaining: true }
    ),
    { nightStarted: true, rainStarted: true }
  );
});

test("self-guard environment ignores unchanged and reverse transitions", () => {
  assert.deepEqual(
    detectSelfGuardEnvironmentTransitions(
      { isDay: false, isRaining: true },
      { isDay: true, isRaining: false }
    ),
    { nightStarted: false, rainStarted: false }
  );
  assert.deepEqual(
    detectSelfGuardEnvironmentTransitions(
      { isDay: false },
      { isDay: false, isRaining: true }
    ),
    { nightStarted: false, rainStarted: false }
  );
});
