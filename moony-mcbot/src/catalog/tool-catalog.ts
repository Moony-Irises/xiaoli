export type ToolDomain =
  | "observe"
  | "mine"
  | "movement"
  | "combat"
  | "chat"
  | "inventory"
  | "interaction";

export type ToolRisk = "read" | "write" | "destructive";
export type ToolAudience = "agent" | "developer" | "web";

export interface ToolCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly domain: ToolDomain;
  readonly risk: ToolRisk;
  readonly audiences: readonly ToolAudience[];
  readonly defaultAgentAllowed: boolean;
}

export const AGENT_CORE_TOOL_CATALOG = [
  {
    id: "observe.self",
    title: "观察自身",
    description: "Get bot's own status snapshot",
    domain: "observe",
    risk: "read",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "observe.inventory",
    title: "观察背包",
    description: "List bot inventory items and currently held item",
    domain: "observe",
    risk: "read",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "observe.nearbyPlayers",
    title: "观察附近玩家",
    description: "List nearby players by distance",
    domain: "observe",
    risk: "read",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "observe.nearbyEntities",
    title: "观察附近实体",
    description: "List nearby non-player entities",
    domain: "observe",
    risk: "read",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "mine.collectVisible",
    title: "采集可见方块",
    description: "Collect multiple visible blocks by names (line-of-sight constrained mining loop)",
    domain: "mine",
    risk: "destructive",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "move.followPlayer",
    title: "跟随玩家",
    description: "Continuously follow a nearby player (pathfinder first, steering fallback)",
    domain: "movement",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "move.stopFollow",
    title: "停止跟随",
    description: "Stop follow loop for this bot",
    domain: "movement",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "move.goToPosition",
    title: "移动到坐标",
    description: "Move toward an explicit world position",
    domain: "movement",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "combat.challengeEntity",
    title: "挑战实体",
    description: "Start a full duel against a nearby non-player entity matched by target text",
    domain: "combat",
    risk: "destructive",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "chat.requestTeleportToPlayer",
    title: "请求传送到玩家",
    description: "Send a teleport request to an explicit player",
    domain: "chat",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "chat.send",
    title: "发送聊天",
    description: "Send chat message in game",
    domain: "chat",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "combat.prepareBattle",
    title: "准备战斗",
    description: "Prepare for combat: prefer iron sword in hotbar 1, otherwise best weapon; equip best armor; hold the weapon",
    domain: "combat",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "inventory.holdByCategory",
    title: "按类别持有物品",
    description: "Equip best item in category: sword/axe/pickaxe/food",
    domain: "inventory",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "inventory.organizeHotbar",
    title: "整理快捷栏",
    description: "One-click organize hotbar: 1=sword, 2=axe, 3=pickaxe, 9=food",
    domain: "inventory",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "interact.dropHeld",
    title: "丢出手持物品",
    description: "Drop currently held item: one (tap Q) or stack (hold Q)",
    domain: "interaction",
    risk: "destructive",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "interact.dropHotbarSlot",
    title: "丢出快捷栏物品",
    description: "Drop item from a specific hotbar slot (1-9): one or full stack",
    domain: "interaction",
    risk: "destructive",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  },
  {
    id: "interact.openDoor",
    title: "开门",
    description: "Open or toggle a door block by right-clicking it",
    domain: "interaction",
    risk: "write",
    audiences: ["agent", "developer"],
    defaultAgentAllowed: true
  }
] as const satisfies readonly ToolCatalogEntry[];

export type AgentCoreToolId = (typeof AGENT_CORE_TOOL_CATALOG)[number]["id"];
export type AgentCoreToolCatalogEntry = (typeof AGENT_CORE_TOOL_CATALOG)[number];

export function assertToolCatalogIntegrity(
  entries: readonly ToolCatalogEntry[] = AGENT_CORE_TOOL_CATALOG
): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry.id.trim()) throw new Error("Tool catalog entry id is required");
    if (entry.id !== entry.id.trim()) throw new Error(`Tool catalog id '${entry.id}' contains surrounding whitespace`);
    if (ids.has(entry.id)) throw new Error(`Duplicate tool catalog id '${entry.id}'`);
    ids.add(entry.id);

    if (!entry.title.trim()) throw new Error(`Tool catalog '${entry.id}' requires a title`);
    if (!entry.description.trim()) throw new Error(`Tool catalog '${entry.id}' requires a description`);
    if (new Set(entry.audiences).size !== entry.audiences.length) {
      throw new Error(`Tool catalog '${entry.id}' contains duplicate audiences`);
    }
    if (entry.defaultAgentAllowed && !entry.audiences.includes("agent")) {
      throw new Error(`Tool catalog '${entry.id}' is default Agent allowed without Agent audience`);
    }
  }
}

assertToolCatalogIntegrity();

const AGENT_CORE_TOOL_BY_ID = new Map<AgentCoreToolId, AgentCoreToolCatalogEntry>(
  AGENT_CORE_TOOL_CATALOG.map((entry) => [entry.id, entry])
);

export function getToolCatalogEntry(id: string): AgentCoreToolCatalogEntry | undefined {
  return AGENT_CORE_TOOL_BY_ID.get(id as AgentCoreToolId);
}

export function isAgentCoreToolId(id: string): id is AgentCoreToolId {
  return AGENT_CORE_TOOL_BY_ID.has(id as AgentCoreToolId);
}

export function getDefaultAgentToolIds(): AgentCoreToolId[] {
  return AGENT_CORE_TOOL_CATALOG
    .filter((entry) => entry.defaultAgentAllowed)
    .map((entry) => entry.id);
}

export function resolveAgentToolAllowlist(
  persisted: readonly string[] | undefined,
  fallback: readonly string[] = getDefaultAgentToolIds()
): string[] {
  return [...(persisted ?? fallback)].filter(Boolean);
}
