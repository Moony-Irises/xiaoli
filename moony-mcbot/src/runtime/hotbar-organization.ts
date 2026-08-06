import type {
  HeldItemCategory,
  HotbarOrganizationAction,
  InventoryEntrySnapshot
} from "./client-adapter.js";

interface InventorySlotState {
  slot: number;
  item: InventoryEntrySnapshot | null;
}

export interface HotbarSlotMove {
  fromSlot: number;
  toSlot: number;
}

export interface HotbarOrganizationPlan {
  actions: HotbarOrganizationAction[];
  moves: HotbarSlotMove[];
  selectedHotbarSlot: number;
}

const INVENTORY_SLOT_MIN = 9;
const INVENTORY_SLOT_MAX = 44;
const HOTBAR_INVENTORY_SLOT_OFFSET = 35;

const HOTBAR_RULES: ReadonlyArray<{ category: HeldItemCategory; hotbarSlot: number }> = [
  { category: "sword", hotbarSlot: 1 },
  { category: "axe", hotbarSlot: 2 },
  { category: "pickaxe", hotbarSlot: 3 },
  { category: "food", hotbarSlot: 9 }
];

function toInventorySlot(hotbarSlot: number): number {
  return HOTBAR_INVENTORY_SLOT_OFFSET + hotbarSlot;
}

function isFoodItemName(name: string): boolean {
  return /(^|_)(bread|apple|carrot|potato|beetroot|cookie|pumpkin_pie|melon_slice|dried_kelp|kelp|berries|stew|cooked|golden_carrot|honey_bottle|chorus_fruit|rabbit|salmon|cod|mutton|porkchop|beef|chicken|rotten_flesh)(_|$)/.test(
    name
  );
}

function matchesCategory(name: string, category: HeldItemCategory): boolean {
  if (category === "food") return isFoodItemName(name);
  return name.endsWith(category === "pickaxe" ? "_pickaxe" : `_${category}`);
}

function tierScore(name: string): number {
  if (name.includes("netherite")) return 7;
  if (name.includes("diamond")) return 6;
  if (name.includes("iron")) return 5;
  if (name.includes("golden")) return 4;
  if (name.includes("stone")) return 3;
  if (name.includes("wooden")) return 2;
  return 1;
}

export function buildHotbarOrganizationPlan(
  slots: readonly InventorySlotState[]
): HotbarOrganizationPlan {
  const slotState = new Map<number, InventoryEntrySnapshot | null>();
  for (let slot = INVENTORY_SLOT_MIN; slot <= INVENTORY_SLOT_MAX; slot += 1) {
    slotState.set(slot, null);
  }
  for (const entry of slots) {
    if (entry.slot < INVENTORY_SLOT_MIN || entry.slot > INVENTORY_SLOT_MAX) continue;
    slotState.set(entry.slot, entry.item ? { ...entry.item } : null);
  }

  const protectedTargetSlots = new Set(HOTBAR_RULES.map((rule) => toInventorySlot(rule.hotbarSlot)));
  const usedSourceSlots = new Set<number>();
  const actions: HotbarOrganizationAction[] = [];
  const moves: HotbarSlotMove[] = [];

  for (const rule of HOTBAR_RULES) {
    const targetSlot = toInventorySlot(rule.hotbarSlot);
    const candidates = [...slotState.entries()]
      .filter(([slot, item]) => !!item && !usedSourceSlots.has(slot) && matchesCategory(item.name, rule.category))
      .map(([slot, item]) => ({ slot, item: item as InventoryEntrySnapshot }))
      .sort((left, right) => {
        const tierDifference = tierScore(right.item.name) - tierScore(left.item.name);
        if (tierDifference !== 0) return tierDifference;
        const countDifference = right.item.count - left.item.count;
        return countDifference !== 0 ? countDifference : left.slot - right.slot;
      });
    const selected = candidates[0];
    if (!selected) {
      actions.push({ category: rule.category, status: "missing" });
      continue;
    }

    usedSourceSlots.add(selected.slot);
    const targetItem = slotState.get(targetSlot) ?? null;
    if (selected.slot !== targetSlot && targetItem) {
      const temporarySlot = [...slotState.entries()]
        .filter(([slot, item]) => item === null && !protectedTargetSlots.has(slot) && !usedSourceSlots.has(slot))
        .map(([slot]) => slot)
        .sort((left, right) => left - right)[0];
      if (temporarySlot === undefined) {
        actions.push({
          category: rule.category,
          status: "failed_no_empty_slot",
          item: selected.item.name,
          fromSlot: selected.slot,
          toHotbar: rule.hotbarSlot
        });
        continue;
      }
      moves.push({ fromSlot: targetSlot, toSlot: temporarySlot });
      slotState.set(temporarySlot, targetItem);
      slotState.set(targetSlot, null);
    }

    if (selected.slot !== targetSlot) {
      moves.push({ fromSlot: selected.slot, toSlot: targetSlot });
      slotState.set(targetSlot, selected.item);
      slotState.set(selected.slot, null);
    }
    actions.push({
      category: rule.category,
      status: "moved",
      item: selected.item.name,
      fromSlot: selected.slot,
      toHotbar: rule.hotbarSlot
    });
  }

  return {
    actions,
    moves,
    selectedHotbarSlot: 1
  };
}
