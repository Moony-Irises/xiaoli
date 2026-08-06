import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateSelfGuardAlertCooldown,
  evaluateSelfGuardCoreTransitions,
  evaluateSelfGuardProximity,
  evaluateSelfGuardReactiveSignals,
  evaluateSelfGuardVitals,
  summarizeInventorySnapshotForEvent
} from "../src/runtime/self-guard-state.js";

const thresholds = {
  lowHealth: 10,
  criticalHealth: 5,
  lowFood: 6,
  autoEat: true
};

test("self-guard alert cooldown stays disabled before validating time inputs", () => {
  assert.deepEqual(
    evaluateSelfGuardAlertCooldown({
      chatAlertsEnabled: false,
      now: Number.NaN,
      lastAlertAt: Number.POSITIVE_INFINITY,
      cooldownMs: -1
    }),
    { allowed: false, reason: "disabled" }
  );
});

test("self-guard alert cooldown allows the first alert after the zero baseline", () => {
  assert.deepEqual(
    evaluateSelfGuardAlertCooldown({
      chatAlertsEnabled: true,
      now: 15_001,
      cooldownMs: 15_000
    }),
    { allowed: true, nextLastAlertAt: 15_001 }
  );
});

test("self-guard alert cooldown suppresses alerts strictly inside the window", () => {
  assert.deepEqual(
    evaluateSelfGuardAlertCooldown({
      chatAlertsEnabled: true,
      now: 24_999,
      lastAlertAt: 10_000,
      cooldownMs: 15_000
    }),
    { allowed: false, reason: "cooldown" }
  );
});

test("self-guard alert cooldown allows alerts exactly at the boundary", () => {
  assert.deepEqual(
    evaluateSelfGuardAlertCooldown({
      chatAlertsEnabled: true,
      now: 25_000,
      lastAlertAt: 10_000,
      cooldownMs: 15_000
    }),
    { allowed: true, nextLastAlertAt: 25_000 }
  );
});

test("self-guard alert cooldown fails closed for invalid time inputs", () => {
  const invalidInputs = [
    {
      chatAlertsEnabled: true,
      now: Number.NaN,
      cooldownMs: 15_000
    },
    {
      chatAlertsEnabled: true,
      now: 20_000,
      lastAlertAt: Number.POSITIVE_INFINITY,
      cooldownMs: 15_000
    },
    {
      chatAlertsEnabled: true,
      now: 20_000,
      cooldownMs: -1
    }
  ];

  for (const input of invalidInputs) {
    assert.deepEqual(
      evaluateSelfGuardAlertCooldown(input),
      { allowed: false, reason: "invalid_input" }
    );
  }
});

test("self-guard vitals preserve inclusive warning thresholds", () => {
  const decision = evaluateSelfGuardVitals(
    { health: 5, food: 6 },
    thresholds
  );

  assert.deepEqual(decision, {
    available: true,
    health: 5,
    food: 6,
    lowHealth: true,
    criticalHealth: true,
    lowFood: true,
    shouldEatForFood: true,
    shouldEatForHealing: true,
    shouldEatNow: true,
    shouldSetCalm: false
  });
});

test("self-guard healing eat remains strict below low health and full food", () => {
  const atHealthBoundary = evaluateSelfGuardVitals(
    { health: 10, food: 19 },
    thresholds
  );
  const atFullFood = evaluateSelfGuardVitals(
    { health: 9, food: 20 },
    thresholds
  );

  assert.equal(atHealthBoundary.available, true);
  assert.equal(atHealthBoundary.available && atHealthBoundary.shouldEatForHealing, false);
  assert.equal(atFullFood.available, true);
  assert.equal(atFullFood.available && atFullFood.shouldEatForHealing, false);
});

test("self-guard can eat for healing without crossing the low-food threshold", () => {
  const decision = evaluateSelfGuardVitals(
    { health: 9, food: 19 },
    thresholds
  );

  assert.equal(decision.available, true);
  assert.equal(decision.available && decision.lowFood, false);
  assert.equal(decision.available && decision.shouldEatForHealing, true);
  assert.equal(decision.available && decision.shouldEatNow, true);
});

test("self-guard auto-eat switch does not suppress warning state", () => {
  const decision = evaluateSelfGuardVitals(
    { health: 4, food: 3 },
    { ...thresholds, autoEat: false }
  );

  assert.equal(decision.available, true);
  assert.equal(decision.available && decision.criticalHealth, true);
  assert.equal(decision.available && decision.lowFood, true);
  assert.equal(decision.available && decision.shouldEatNow, false);
});

test("self-guard vitals fail closed when state or thresholds are unavailable", () => {
  assert.deepEqual(evaluateSelfGuardVitals(null, thresholds), { available: false });
  assert.deepEqual(evaluateSelfGuardVitals({ health: Number.NaN, food: 10 }, thresholds), { available: false });
  assert.deepEqual(
    evaluateSelfGuardVitals({ health: 10, food: 10 }, { ...thresholds, lowFood: Number.POSITIVE_INFINITY }),
    { available: false }
  );
});

test("self-guard core transitions stay inactive on the first observation", () => {
  const currentBotRef = {};
  const vitals = evaluateSelfGuardVitals({ health: 20, food: 20 }, thresholds);

  assert.deepEqual(
    evaluateSelfGuardCoreTransitions({ currentBotRef, vitals }),
    {
      reconnected: false,
      healthDropped: false
    }
  );
});

test("self-guard core transitions detect only a changed previous bot reference", () => {
  const currentBotRef = {};
  const vitals = evaluateSelfGuardVitals({ health: 20, food: 20 }, thresholds);

  assert.equal(
    evaluateSelfGuardCoreTransitions({
      currentBotRef,
      previousBotRef: currentBotRef,
      vitals
    }).reconnected,
    false
  );
  assert.equal(
    evaluateSelfGuardCoreTransitions({
      currentBotRef,
      previousBotRef: {},
      vitals
    }).reconnected,
    true
  );
});

test("self-guard core transitions preserve the strict health-drop tolerance", () => {
  const currentBotRef = {};

  assert.equal(
    evaluateSelfGuardCoreTransitions({
      currentBotRef,
      previousHealth: 10,
      vitals: evaluateSelfGuardVitals({ health: 9.5, food: 20 }, thresholds)
    }).healthDropped,
    false
  );
  assert.equal(
    evaluateSelfGuardCoreTransitions({
      currentBotRef,
      previousHealth: 10,
      vitals: evaluateSelfGuardVitals({ health: 9.4, food: 20 }, thresholds)
    }).healthDropped,
    true
  );
});

test("self-guard core transitions fail closed without valid health history", () => {
  const currentBotRef = {};
  const availableVitals = evaluateSelfGuardVitals({ health: 5, food: 20 }, thresholds);

  assert.equal(
    evaluateSelfGuardCoreTransitions({
      currentBotRef,
      previousHealth: Number.POSITIVE_INFINITY,
      vitals: availableVitals
    }).healthDropped,
    false
  );
  assert.equal(
    evaluateSelfGuardCoreTransitions({
      currentBotRef,
      previousHealth: 20,
      vitals: { available: false }
    }).healthDropped,
    false
  );
});

test("self-guard reactive signals stay unavailable without valid vitals", () => {
  assert.deepEqual(
    evaluateSelfGuardReactiveSignals(
      { available: false },
      true,
      { lowHealth: true, criticalHealth: true, lowFood: true }
    ),
    { available: false }
  );
});

test("self-guard reactive signals preserve first-entry event order and payloads", () => {
  const vitals = evaluateSelfGuardVitals({ health: 9, food: 5 }, thresholds);

  assert.deepEqual(
    evaluateSelfGuardReactiveSignals(vitals, true),
    {
      available: true,
      nextFlags: {
        lowHealth: true,
        criticalHealth: false,
        lowFood: true
      },
      signals: [
        {
          type: "low_health",
          priority: "high",
          payload: {
            severity: "warning",
            health: 9,
            food: 5,
            hasFood: true,
            reason: "low_health_threshold"
          }
        },
        {
          type: "low_food",
          priority: "high",
          payload: {
            severity: "warning",
            health: 9,
            food: 5,
            hasFood: true,
            reason: "low_food_threshold"
          }
        }
      ]
    }
  );
});

test("self-guard reactive signals suppress unchanged threshold states", () => {
  const vitals = evaluateSelfGuardVitals({ health: 9, food: 5 }, thresholds);

  const decision = evaluateSelfGuardReactiveSignals(
    vitals,
    false,
    { lowHealth: true, criticalHealth: false, lowFood: true }
  );

  assert.equal(decision.available, true);
  assert.deepEqual(decision.available && decision.signals, []);
});

test("self-guard reactive signals report critical escalation and de-escalation", () => {
  const critical = evaluateSelfGuardReactiveSignals(
    evaluateSelfGuardVitals({ health: 5, food: 20 }, thresholds),
    false,
    { lowHealth: true, criticalHealth: false, lowFood: false }
  );
  const warning = evaluateSelfGuardReactiveSignals(
    evaluateSelfGuardVitals({ health: 6, food: 20 }, thresholds),
    false,
    { lowHealth: true, criticalHealth: true, lowFood: false }
  );

  assert.equal(critical.available, true);
  assert.deepEqual(
    critical.available && critical.signals.map((signal) => ({
      priority: signal.priority,
      severity: signal.payload.severity,
      reason: signal.payload.reason
    })),
    [{ priority: "critical", severity: "critical", reason: "critical_health_threshold" }]
  );
  assert.equal(warning.available, true);
  assert.deepEqual(
    warning.available && warning.signals.map((signal) => ({
      priority: signal.priority,
      severity: signal.payload.severity,
      reason: signal.payload.reason
    })),
    [{ priority: "high", severity: "warning", reason: "low_health_threshold" }]
  );
});

test("self-guard reactive signals clear flags without publishing recovery events", () => {
  const decision = evaluateSelfGuardReactiveSignals(
    evaluateSelfGuardVitals({ health: 20, food: 20 }, thresholds),
    true,
    { lowHealth: true, criticalHealth: true, lowFood: true }
  );

  assert.deepEqual(decision, {
    available: true,
    nextFlags: {
      lowHealth: false,
      criticalHealth: false,
      lowFood: false
    },
    signals: []
  });
});

test("inventory event summary groups and sorts adapter snapshot items", () => {
  const summary = summarizeInventorySnapshotForEvent({
    heldItem: null,
    armor: { head: null, torso: null, legs: null, feet: null },
    items: [
      { name: "bread", count: 2 },
      { name: "apple", count: 1 },
      { name: "bread", count: 3 }
    ]
  });

  assert.deepEqual(summary, {
    summary: "applex1|breadx5",
    itemCount: 3
  });
});

test("self-guard proximity includes a valid non-self player at the boundary", () => {
  const decision = evaluateSelfGuardProximity(
    [
      { username: "XiaoLi", distance: 0 },
      { username: "Broken", distance: Number.NaN },
      { username: "Judy", distance: 5 }
    ],
    "XiaoLi",
    5,
    false
  );

  assert.deepEqual(decision, {
    isNear: true,
    enteredNearRange: true
  });
});

test("self-guard proximity fails closed for invalid and out-of-range players", () => {
  const decision = evaluateSelfGuardProximity(
    [
      { username: "Missing" },
      { username: "Negative", distance: -1 },
      { username: "Infinite", distance: Number.POSITIVE_INFINITY },
      { username: "Far", distance: 5.001 }
    ],
    "XiaoLi",
    5,
    true
  );

  assert.deepEqual(decision, {
    isNear: false,
    enteredNearRange: false
  });
});

test("self-guard proximity reports only the transition into near range", () => {
  const players = [{ username: "Judy", distance: 2 }];

  assert.equal(
    evaluateSelfGuardProximity(players, "XiaoLi", 5, false).enteredNearRange,
    true
  );
  assert.equal(
    evaluateSelfGuardProximity(players, "XiaoLi", 5, true).enteredNearRange,
    false
  );
});

test("self-guard proximity rejects invalid maximum distances", () => {
  for (const maxDistance of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () => evaluateSelfGuardProximity([], "XiaoLi", maxDistance, false),
      RangeError
    );
  }
});
