import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateTerritoryWarning,
  type TerritoryWarningInput
} from "../src/runtime/territory-warning-state.js";

const baseInput: TerritoryWarningInput = {
  now: 100,
  warningCooldownMs: 30,
  escalationEnabled: true,
  escalationDelayMs: 80,
  ownerNearby: true
};

test("territory warning emits the first warning and starts presence timing", () => {
  assert.deepEqual(evaluateTerritoryWarning(baseInput), {
    action: "warn",
    nextState: { enteredAt: 100, warnedAt: 100 }
  });
});

test("territory warning suppresses strictly inside the cooldown window", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 129,
      existing: { enteredAt: 100, warnedAt: 100 }
    }),
    { action: "none" }
  );
});

test("territory warning allows the exact cooldown boundary before escalation", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 130,
      existing: { enteredAt: 100, warnedAt: 100, escalatedAt: 110 }
    }),
    {
      action: "warn",
      nextState: { enteredAt: 100, warnedAt: 130 }
    }
  );
});

test("territory warning holds escalation when the owner is not nearby", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 180,
      ownerNearby: false,
      existing: { enteredAt: 100, warnedAt: 170 }
    }),
    { action: "hold_escalation" }
  );
});

test("territory warning suppresses escalation strictly before the delay boundary", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 179,
      existing: { enteredAt: 100, warnedAt: 170 }
    }),
    { action: "none" }
  );
});

test("territory warning escalates at the exact delay boundary when the owner is nearby", () => {
  const existing = { enteredAt: 100, warnedAt: 170 };
  const decision = evaluateTerritoryWarning({
    ...baseInput,
    now: 180,
    existing
  });

  assert.deepEqual(decision, {
    action: "escalate",
    nextState: { enteredAt: 100, warnedAt: 170, escalatedAt: 180 }
  });
  assert.deepEqual(existing, { enteredAt: 100, warnedAt: 170 });
});

test("territory warning does not escalate when disabled or already escalated", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 180,
      escalationEnabled: false,
      existing: { enteredAt: 100, warnedAt: 170 }
    }),
    { action: "none" }
  );
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 180,
      existing: { enteredAt: 100, warnedAt: 170, escalatedAt: 150 }
    }),
    { action: "none" }
  );
});

test("territory warning preserves the legacy falsy zero escalation timestamp", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: 180,
      existing: { enteredAt: 100, warnedAt: 170, escalatedAt: 0 }
    }),
    {
      action: "escalate",
      nextState: { enteredAt: 100, warnedAt: 170, escalatedAt: 180 }
    }
  );
});

test("territory warning fails closed for invalid time state", () => {
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      now: Number.NaN
    }),
    { action: "none" }
  );
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      existing: { enteredAt: Number.NaN, warnedAt: 100 }
    }),
    { action: "none" }
  );
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      warningCooldownMs: -1
    }),
    { action: "none" }
  );
  assert.deepEqual(
    evaluateTerritoryWarning({
      ...baseInput,
      escalationDelayMs: Number.POSITIVE_INFINITY
    }),
    { action: "none" }
  );
});
