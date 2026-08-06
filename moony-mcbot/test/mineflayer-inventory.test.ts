import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureIronSwordInHotbar1AndHold,
  MineflayerCombatHotbarClient,
  moveInventorySlot
} from "../src/runtime/mineflayer-inventory.js";

function createCombatHotbarClient(
  items: Array<{ name: string; slot: number }>
): MineflayerCombatHotbarClient & { moves: Array<[number, number]>; selectedSlots: number[]; heldItemUpdates: number } {
  const slots: Array<{ name: string; slot: number } | null> = Array.from({ length: 45 }, () => null);
  for (const inventoryItem of items) slots[inventoryItem.slot] = inventoryItem;
  return {
    inventory: {
      slots,
      items: () => slots.filter((entry): entry is { name: string; slot: number } => entry !== null)
    },
    moves: [],
    selectedSlots: [],
    heldItemUpdates: 0,
    async moveSlotItem(sourceSlot, destinationSlot): Promise<void> {
      this.moves.push([sourceSlot, destinationSlot]);
      this.inventory.slots[destinationSlot] = this.inventory.slots[sourceSlot];
      this.inventory.slots[sourceSlot] = null;
    },
    setQuickBarSlot(slot): void {
      this.selectedSlots.push(slot);
    },
    updateHeldItem(): void {
      this.heldItemUpdates += 1;
    }
  };
}

test("moveInventorySlot skips a same-slot move", async () => {
  let callCount = 0;
  const moved = await moveInventorySlot({
    async moveSlotItem(): Promise<void> {
      callCount += 1;
    }
  }, 36, 36);

  assert.equal(moved, false);
  assert.equal(callCount, 0);
});

test("moveInventorySlot awaits the Promise-based Mineflayer API", async () => {
  const calls: Array<[number, number]> = [];
  const moved = await moveInventorySlot({
    async moveSlotItem(sourceSlot, destinationSlot): Promise<void> {
      calls.push([sourceSlot, destinationSlot]);
    }
  }, 10, 36);

  assert.equal(moved, true);
  assert.deepEqual(calls, [[10, 36]]);
});

test("moveInventorySlot propagates a rejected Mineflayer move", async () => {
  await assert.rejects(
    moveInventorySlot({
      async moveSlotItem(): Promise<void> {
        throw new Error("slot move rejected");
      }
    }, 10, 36),
    /slot move rejected/
  );
});

test("ensureIronSwordInHotbar1AndHold moves an occupied target aside and selects slot one", async () => {
  const client = createCombatHotbarClient([
    { name: "iron_sword", slot: 10 },
    { name: "dirt", slot: 36 }
  ]);

  const result = await ensureIronSwordInHotbar1AndHold(client);

  assert.deepEqual(result, { moved: true, selected: true });
  assert.deepEqual(client.moves, [[36, 9], [10, 36]]);
  assert.equal(client.inventory.slots[36]?.name, "iron_sword");
  assert.equal(client.inventory.slots[9]?.name, "dirt");
  assert.deepEqual(client.selectedSlots, [0]);
  assert.equal(client.heldItemUpdates, 1);
});

test("ensureIronSwordInHotbar1AndHold leaves an existing slot-one sword in place", async () => {
  const client = createCombatHotbarClient([{ name: "iron_sword", slot: 36 }]);

  const result = await ensureIronSwordInHotbar1AndHold(client);

  assert.deepEqual(result, { moved: false, selected: true });
  assert.deepEqual(client.moves, []);
  assert.deepEqual(client.selectedSlots, [0]);
});

test("ensureIronSwordInHotbar1AndHold fails without overwriting a full inventory", async () => {
  const items = Array.from({ length: 36 }, (_, index) => ({
    name: index === 1 ? "iron_sword" : "dirt",
    slot: index + 9
  }));
  const client = createCombatHotbarClient(items);

  await assert.rejects(
    ensureIronSwordInHotbar1AndHold(client),
    /No empty slot available/
  );
  assert.deepEqual(client.moves, []);
  assert.equal(client.inventory.slots[36]?.name, "dirt");
});
