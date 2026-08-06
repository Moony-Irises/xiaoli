import assert from "node:assert/strict";
import test from "node:test";
import { buildHotbarOrganizationPlan } from "../src/runtime/hotbar-organization.js";

function item(name: string, count = 1): { name: string; displayName: null; count: number } {
  return { name, displayName: null, count };
}

test("buildHotbarOrganizationPlan places the best tools and food in fixed slots", () => {
  const plan = buildHotbarOrganizationPlan([
    { slot: 9, item: item("iron_sword") },
    { slot: 10, item: item("diamond_sword") },
    { slot: 11, item: item("iron_axe") },
    { slot: 12, item: item("stone_pickaxe") },
    { slot: 13, item: item("bread", 3) },
    { slot: 14, item: item("golden_carrot", 1) }
  ]);

  assert.deepEqual(plan.moves, [
    { fromSlot: 10, toSlot: 36 },
    { fromSlot: 11, toSlot: 37 },
    { fromSlot: 12, toSlot: 38 },
    { fromSlot: 14, toSlot: 44 }
  ]);
  assert.deepEqual(plan.actions.map((action) => [action.category, action.item, action.toHotbar]), [
    ["sword", "diamond_sword", 1],
    ["axe", "iron_axe", 2],
    ["pickaxe", "stone_pickaxe", 3],
    ["food", "golden_carrot", 9]
  ]);
  assert.equal(plan.selectedHotbarSlot, 1);
});

test("buildHotbarOrganizationPlan uses a temporary slot when protected targets are swapped", () => {
  const plan = buildHotbarOrganizationPlan([
    { slot: 36, item: item("diamond_axe") },
    { slot: 37, item: item("diamond_sword") }
  ]);

  assert.deepEqual(plan.moves, [
    { fromSlot: 36, toSlot: 9 },
    { fromSlot: 37, toSlot: 36 },
    { fromSlot: 9, toSlot: 37 }
  ]);
  assert.equal(plan.actions[0]?.status, "moved");
  assert.equal(plan.actions[1]?.status, "moved");
});

test("buildHotbarOrganizationPlan reports missing categories", () => {
  const plan = buildHotbarOrganizationPlan([{ slot: 9, item: item("dirt", 64) }]);

  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.actions.map((action) => action.status), ["missing", "missing", "missing", "missing"]);
});

test("buildHotbarOrganizationPlan does not overwrite a target when inventory has no temporary slot", () => {
  const slots = Array.from({ length: 36 }, (_, index) => ({
    slot: index + 9,
    item: item(index === 1 ? "diamond_sword" : "dirt", 64)
  }));
  const plan = buildHotbarOrganizationPlan(slots);

  assert.deepEqual(plan.moves, []);
  assert.deepEqual(plan.actions[0], {
    category: "sword",
    status: "failed_no_empty_slot",
    item: "diamond_sword",
    fromSlot: 10,
    toHotbar: 1
  });
});
