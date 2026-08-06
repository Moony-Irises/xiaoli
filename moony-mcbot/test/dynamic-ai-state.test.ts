import assert from "node:assert/strict";
import test from "node:test";
import { buildDynamicAiStateText } from "../src/runtime/dynamic-ai-state.js";

test("dynamic AI state formats a complete adapter-backed snapshot", () => {
  assert.equal(
    buildDynamicAiStateText({
      activity: "跟随 Judy",
      nearestPlayerDistance: 5.5,
      nearPlayerDistance: 6,
      minutesSinceProactive: 3,
      mood: "平静",
      health: 18.24,
      food: 14,
      heldItemName: "iron_pickaxe",
      foodCount: 7,
      focusTarget: "zombie"
    }),
    [
      "你目前正在：跟随 Judy",
      "玩家距离你：近",
      "上一次你主动说话：3分钟前",
      "你的心情：平静",
      "你的状态：血量=18.2，饥饿=14/20，手持=iron_pickaxe，食物总数=7",
      "你正看着：zombie"
    ].join("\n")
  );
});

test("dynamic AI state preserves distance and speaking-time boundaries", () => {
  const text = buildDynamicAiStateText({
    activity: "待命",
    nearestPlayerDistance: 6,
    nearPlayerDistance: 6,
    minutesSinceProactive: 0,
    mood: "平静",
    health: 20,
    food: 20,
    heldItemName: null,
    foodCount: 0,
    focusTarget: null
  });

  assert.match(text, /玩家距离你：近/);
  assert.match(text, /上一次你主动说话：0分钟前/);
  assert.match(text, /手持=empty/);
  assert.match(text, /你正看着：没有明确目标$/);
});

test("dynamic AI state marks optional invalid values as unknown", () => {
  const text = buildDynamicAiStateText({
    activity: "待命",
    nearestPlayerDistance: Number.NaN,
    nearPlayerDistance: 6,
    minutesSinceProactive: null,
    mood: "平静",
    health: Number.POSITIVE_INFINITY,
    food: undefined,
    heldItemName: undefined,
    foodCount: 0,
    focusTarget: undefined
  });

  assert.match(text, /玩家距离你：未知/);
  assert.match(text, /上一次你主动说话：从未/);
  assert.match(text, /你的状态：血量=unknown，饥饿=unknown，手持=empty，食物总数=0/);
});
