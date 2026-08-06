import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInventorySummary,
  ContainerTransferItem,
  matchInventoryItems,
  readContainerItems,
  serializeInventoryItem
} from "../src/runtime/container-inventory.js";

function item(
  name: string,
  count: number,
  options: { displayName?: string; slot?: number; type?: number; metadata?: number | null } = {}
): ContainerTransferItem {
  return {
    name,
    displayName: options.displayName,
    count,
    slot: options.slot ?? 0,
    type: options.type ?? 1,
    metadata: options.metadata ?? null
  };
}

test("serializeInventoryItem preserves the existing public item shape", () => {
  assert.deepEqual(serializeInventoryItem(item("cooked_salmon", 3, { slot: 12, type: 727 })), {
    name: "cooked_salmon",
    displayName: null,
    count: 3,
    slot: 12
  });
});

test("buildInventorySummary groups stacks and sorts by count then name", () => {
  assert.deepEqual(
    buildInventorySummary([
      item("stone", 2),
      item("apple", 3),
      item("stone", 1),
      item("bread", 3)
    ]),
    [
      { name: "apple", count: 3 },
      { name: "bread", count: 3 },
      { name: "stone", count: 3 }
    ]
  );
});

test("matchInventoryItems preserves exact-name and display-name includes behavior", () => {
  const items = [
    item("cooked_salmon", 2, { displayName: "Cooked Salmon" }),
    item("salmon", 1, { displayName: "Raw Salmon" }),
    item("cod", 4, { displayName: "Raw Cod" })
  ];

  assert.deepEqual(matchInventoryItems(items, " SALMON ", "exact"), [items[1]]);
  assert.deepEqual(matchInventoryItems(items, "raw", "includes"), [items[1], items[2]]);
});

test("readContainerItems prefers top-section items, falls back to window items, then empty", () => {
  const topItems = [item("diamond", 1)];
  const windowItems = [item("dirt", 64)];

  assert.equal(
    readContainerItems({ containerItems: () => topItems, items: () => windowItems }),
    topItems
  );
  assert.equal(readContainerItems({ items: () => windowItems }), windowItems);
  assert.deepEqual(readContainerItems({}), []);
});
