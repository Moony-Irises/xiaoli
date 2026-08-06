export interface InventoryItemView {
  name: string;
  displayName?: string | null;
  count: number;
  slot: number;
}

export interface ContainerTransferItem extends InventoryItemView {
  type: number;
  metadata?: number | null;
}

export interface ContainerInventoryClient {
  containerItems?: () => ContainerTransferItem[];
  items?: () => ContainerTransferItem[];
  deposit?: (itemType: number, metadata: number | null, count: number) => Promise<void>;
  withdraw?: (itemType: number, metadata: number | null, count: number) => Promise<void>;
  close?: () => void;
}

export interface SerializedInventoryItem {
  name: string;
  displayName: string | null;
  count: number;
  slot: number;
}

export function serializeInventoryItem(item: InventoryItemView): SerializedInventoryItem {
  return {
    name: item.name,
    displayName: item.displayName ?? null,
    count: item.count,
    slot: item.slot
  };
}

export function buildInventorySummary(
  items: readonly Pick<InventoryItemView, "name" | "count">[]
): Array<{ name: string; count: number }> {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(String(item.name), (totals.get(String(item.name)) ?? 0) + Number(item.count ?? 0));
  }
  return [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function matchInventoryItems<T extends Pick<InventoryItemView, "name" | "displayName">>(
  items: readonly T[],
  query: string,
  matchMode: "exact" | "includes"
): T[] {
  const needle = String(query ?? "").trim().toLowerCase();
  return items.filter((item) => {
    const haystack = `${item.name ?? ""} ${item.displayName ?? ""}`.toLowerCase();
    return matchMode === "exact" ? String(item.name ?? "").toLowerCase() === needle : haystack.includes(needle);
  });
}

export function readContainerItems(container: ContainerInventoryClient): ContainerTransferItem[] {
  if (typeof container.containerItems === "function") return container.containerItems();
  if (typeof container.items === "function") return container.items();
  return [];
}
