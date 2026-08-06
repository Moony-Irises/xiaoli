export interface MineflayerSlotMover {
  moveSlotItem(sourceSlot: number, destinationSlot: number): Promise<void>;
}

interface MineflayerInventoryItem {
  name: string;
  slot?: number;
}

export interface MineflayerCombatHotbarClient extends MineflayerSlotMover {
  inventory: {
    slots: Array<MineflayerInventoryItem | null | undefined>;
    items(): MineflayerInventoryItem[];
  };
  setQuickBarSlot(slot: number): void;
  updateHeldItem(): void;
}

export async function moveInventorySlot(
  client: MineflayerSlotMover,
  sourceSlot: number,
  destinationSlot: number
): Promise<boolean> {
  if (sourceSlot === destinationSlot) return false;
  await client.moveSlotItem(sourceSlot, destinationSlot);
  return true;
}

function findEmptyInventorySlot(
  client: MineflayerCombatHotbarClient,
  excludedSlots: ReadonlySet<number>
): number | null {
  for (let slot = 9; slot <= 44; slot += 1) {
    if (excludedSlots.has(slot)) continue;
    if (!client.inventory.slots[slot]) return slot;
  }
  return null;
}

export async function ensureIronSwordInHotbar1AndHold(
  client: MineflayerCombatHotbarClient
): Promise<{ moved: boolean; selected: boolean }> {
  const targetSlot = 36;
  let moved = false;

  if (client.inventory.slots[targetSlot]?.name !== "iron_sword") {
    const ironSword = client.inventory
      .items()
      .find((item) => item.name === "iron_sword" && typeof item.slot === "number");
    if (!ironSword || ironSword.slot === undefined) {
      throw new Error("No iron_sword found in inventory");
    }

    if (client.inventory.slots[targetSlot]) {
      const temporarySlot = findEmptyInventorySlot(client, new Set([targetSlot, ironSword.slot]));
      if (temporarySlot === null) {
        throw new Error("No empty slot available to move current hotbar slot 1 item");
      }
      await moveInventorySlot(client, targetSlot, temporarySlot);
    }

    if (ironSword.slot !== targetSlot) {
      await moveInventorySlot(client, ironSword.slot, targetSlot);
      moved = true;
    }
  }

  client.setQuickBarSlot(0);
  client.updateHeldItem();
  return { moved, selected: true };
}
