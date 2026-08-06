import mineflayer from "mineflayer";
import * as Pathfinder from "mineflayer-pathfinder";
import { McClientService } from "../services/mc-client-service.js";
import { RuntimeState } from "../types.js";
import {
  ActionResult,
  AttackEntityInput,
  AttackNearestEntityInput,
  AttackPlayerInput,
  BlockObservationSnapshot,
  BlockSnapshot,
  ClientAdapter,
  ClientChatEventHandler,
  ClientEntityEventHandler,
  ClientAdapterConnectContext,
  ClientAdapterDropMode,
  ClientCapability,
  ClientConnectionState,
  ClientMovementAction,
  ClientMovementEventHandler,
  ClientMovementFailedEvent,
  ClientMovementFailureReason,
  EatFoodInput,
  DropHotbarSlotInput,
  EntitySnapshot,
  HeldItemCategory,
  HoldHotbarSlotInput,
  HoldItemByCategoryInput,
  InventoryEntrySnapshot,
  InventorySnapshot,
  MineBlockInput,
  MineBlockResult,
  MoveToInput,
  OpenDoorInput,
  OrganizeHotbarResult,
  PlayerSnapshot,
  PursueEntityInput,
  SelfStateSnapshot,
  UseItemInput,
  WalkForwardInput
} from "./client-adapter.js";
import { buildHotbarOrganizationPlan } from "./hotbar-organization.js";
import { moveInventorySlot } from "./mineflayer-inventory.js";
import {
  canSeeBlockByRay,
  equipBestToolForBlock,
  MineflayerMiningBlock,
  MineflayerMiningClient,
  MiningPosition,
  miningPositionDistance
} from "./mineflayer-mining.js";
import {
  assessMiningPathUpdate,
  assessSafePathUpdate,
  MiningApproachFailureReason,
  SafePathError,
  SafePathStatus
} from "./mining-approach.js";
import { applySafePathfinderMovementProfile } from "./pathfinder-movement-profile.js";
import type { PathfinderMovementSettings } from "./pathfinder-movement-profile.js";
import { decidePositionMovement } from "./position-movement.js";

type WalkState = "forward" | "back" | "left" | "right" | "jump" | "sprint" | "sneak";

const WALK_STATES: WalkState[] = ["forward", "back", "left", "right", "jump", "sprint", "sneak"];
const INITIAL_PATH_ASSESSMENT_TIMEOUT_MS = 6500;

function forceStopMovement(bot: mineflayer.Bot): void {
  const pathApi = bot.pathfinder as unknown as PathfinderApi | undefined;
  if (pathApi && typeof pathApi.setGoal === "function") {
    try {
      pathApi.setGoal(null);
    } catch {
      // Control states still need to be released when pathfinder itself is unhealthy.
    }
    if (typeof pathApi.stop === "function") {
      try {
        pathApi.stop();
      } catch {
        // Control states are the final fail-closed boundary.
      }
    }
  }
  for (const key of WALK_STATES) {
    bot.setControlState(key, false);
  }
}

interface PathfinderApi {
  setMovements(movements: PathfinderMovementSettings): void;
  setGoal(goal: unknown, dynamic?: boolean): void;
  stop?(): void;
}

interface PathfinderBotState {
  __moonySafeMovements?: PathfinderMovementSettings;
}

interface PathfinderPathUpdate {
  status: SafePathStatus;
  path: Array<{ x: number; y: number; z: number }>;
}

interface ActivePathAssessment {
  supersede(): void;
}

type InitialPathAssessmentResult = "accepted" | "superseded";

interface MiningApproachResult {
  outcome: "reached" | "pathfinder_unavailable" | "approach_unreachable";
  reason?: MiningApproachFailureReason;
}

interface PathfinderModuleShape {
  Movements?: new (bot: mineflayer.Bot) => PathfinderMovementSettings;
  goals?: {
    GoalNear?: new (x: number, y: number, z: number, range: number) => unknown;
  };
  default?: PathfinderModuleShape;
}

function getPathfinderModule(): PathfinderModuleShape {
  return Pathfinder as unknown as PathfinderModuleShape;
}

function ensureSafePathfinder(bot: mineflayer.Bot): PathfinderApi | null {
  const compatibleBot = bot as mineflayer.Bot & PathfinderBotState;
  const pathApi = bot.pathfinder as unknown as PathfinderApi | undefined;
  if (!pathApi || typeof pathApi.setMovements !== "function") return null;

  const module = getPathfinderModule();
  const MovementsCtor = module.Movements ?? module.default?.Movements;
  if (!MovementsCtor) return null;

  try {
    if (!compatibleBot.__moonySafeMovements) {
      compatibleBot.__moonySafeMovements = new MovementsCtor(bot);
      applySafePathfinderMovementProfile(compatibleBot.__moonySafeMovements);
    }
    pathApi.setMovements(compatibleBot.__moonySafeMovements);
    return pathApi;
  } catch {
    return null;
  }
}

function toPositionSnapshot(position: { x: number; y: number; z: number } | null | undefined): { x: number; y: number; z: number } | undefined {
  if (!position) return undefined;
  return {
    x: position.x,
    y: position.y,
    z: position.z
  };
}

function toBlockSnapshot(block: { name?: string; displayName?: string; position?: { x: number; y: number; z: number } } | null | undefined): BlockSnapshot | null {
  if (!block?.position || !block.name) return null;
  return {
    name: block.name,
    displayName: block.displayName ?? null,
    position: {
      x: block.position.x,
      y: block.position.y,
      z: block.position.z
    }
  };
}

function toInventoryEntrySnapshot(item: { name?: string; displayName?: string; count?: number; slot?: number } | null | undefined): InventoryEntrySnapshot | null {
  if (!item?.name) return null;
  return {
    name: item.name,
    displayName: item.displayName ?? null,
    count: Number(item.count ?? 0),
    slot: typeof item.slot === "number" ? item.slot : undefined
  };
}

async function tossSingle(bot: mineflayer.Bot, item: { type: number; metadata: number | null }): Promise<void> {
  await bot.toss(item.type, item.metadata, 1);
}

async function tossWholeStack(bot: mineflayer.Bot, item: unknown): Promise<void> {
  await bot.tossStack(item as never);
}

async function selectHotbarSlot(bot: mineflayer.Bot, slot1to9: number): Promise<void> {
  bot.setQuickBarSlot(slot1to9 - 1);
  bot.updateHeldItem();
}

function isFoodItemName(name: string): boolean {
  if (!name) return false;
  return /(^|_)(bread|apple|carrot|potato|beetroot|cookie|pumpkin_pie|melon_slice|dried_kelp|kelp|berries|stew|cooked|golden_carrot|honey_bottle|chorus_fruit|rabbit|salmon|cod|mutton|porkchop|beef|chicken|rotten_flesh)(_|$)/.test(
    name
  );
}

function getBestFoodItem<T extends { name: string }>(items: T[]): T | null {
  const foods = items.filter((item) => isFoodItemName(item.name));
  if (foods.length === 0) return null;
  foods.sort((a, b) => {
    const score = (name: string): number =>
      (name.includes("golden") ? 4 : 0) +
      (name.includes("cooked") ? 3 : 0) +
      (name.includes("stew") ? 2 : 0) +
      (name.includes("bread") ? 1 : 0);
    return score(b.name) - score(a.name);
  });
  return foods[0];
}

function toolTierScore(name: string): number {
  if (name.includes("netherite")) return 7;
  if (name.includes("diamond")) return 6;
  if (name.includes("iron")) return 5;
  if (name.includes("golden")) return 4;
  if (name.includes("stone")) return 3;
  if (name.includes("wooden")) return 2;
  return 1;
}

function findBestWeaponItem<T extends { name: string }>(items: T[]): T | null {
  const weapons = items.filter((item) => item.name.endsWith("_sword") || item.name.endsWith("_axe"));
  if (weapons.length === 0) return null;
  weapons.sort((a, b) => {
    const typeScore = (name: string): number => (name.endsWith("_sword") ? 2 : 1);
    return toolTierScore(b.name) + typeScore(b.name) - (toolTierScore(a.name) + typeScore(a.name));
  });
  return weapons[0];
}

function findBestCategoryItem<T extends { name: string }>(items: T[], category: HeldItemCategory): T | null {
  if (category === "food") return getBestFoodItem(items);
  const suffix = category === "pickaxe" ? "_pickaxe" : `_${category}`;
  const candidates = items.filter((item) => item.name.endsWith(suffix));
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => toolTierScore(b.name) - toolTierScore(a.name));
  return candidates[0];
}

function isDoorBlockName(name: string): boolean {
  if (!name) return false;
  return name.endsWith("_door") || name === "iron_door";
}

export class MineflayerAdapter implements ClientAdapter {
  readonly kind = "mineflayer" as const;

  private bot: mineflayer.Bot | null = null;
  private runtimeState: RuntimeState = "idle";
  private combatHitCounter = 0;
  private readonly chatSubscriptions = new Set<() => void>();
  private readonly entitySubscriptions = new Set<() => void>();
  private readonly movementSubscriptions = new Set<() => void>();
  private readonly movementEventHandlers = new Set<ClientMovementEventHandler>();
  private movementSequence = 0;
  private activePathAssessment: ActivePathAssessment | null = null;
  private disconnectPromise: Promise<void> | null = null;

  constructor(private readonly mcClientService: McClientService) {}

  async connect(context: ClientAdapterConnectContext): Promise<void> {
    if (this.disconnectPromise) {
      throw new Error("Client adapter disconnect is in progress");
    }
    this.runtimeState = "connecting";
    this.bot = this.mcClientService.createBot(context.config, context.session);
  }

  async awaitReady(timeoutMs = 20000): Promise<void> {
    const bot = this.getNativeMineflayerBotOrThrow();
    await this.mcClientService.awaitSpawn(bot, timeoutMs);
    this.runtimeState = "spawned";
  }

  disconnect(reason = "Disconnected by MCP tool"): Promise<void> {
    if (this.disconnectPromise) {
      return this.disconnectPromise;
    }

    const pending = this.disconnectOnce(reason).finally(() => {
      if (this.disconnectPromise === pending) {
        this.disconnectPromise = null;
      }
    });
    this.disconnectPromise = pending;
    return pending;
  }

  private async disconnectOnce(reason: string): Promise<void> {
    this.supersedeActivePathAssessment();
    this.clearChatSubscriptions();
    this.clearEntitySubscriptions();
    this.clearMovementSubscriptions();
    this.runtimeState = "disconnected";

    const bot = this.bot;
    if (!bot) return;

    try {
      await this.mcClientService.disconnect(bot, reason);
    } finally {
      if (this.bot === bot) {
        this.bot = null;
      }
      this.runtimeState = "disconnected";
    }
  }

  getConnectionState(): ClientConnectionState {
    return {
      kind: this.kind,
      runtimeState: this.runtimeState,
      connected: this.runtimeState === "spawned" && !!this.bot
    };
  }

  supportsCapability(capability: ClientCapability): boolean {
    return (
      capability === "attack_entity" ||
      capability === "attack_nearest_entity" ||
      capability === "attack_player" ||
      capability === "send_chat" ||
      capability === "drop_held_item" ||
      capability === "drop_hotbar_slot" ||
      capability === "eat_food" ||
      capability === "follow_player" ||
      capability === "hold_hotbar_slot" ||
      capability === "hold_item_by_category" ||
      capability === "mine_block" ||
      capability === "organize_hotbar" ||
      capability === "move_to_position" ||
      capability === "pursue_entity" ||
      capability === "look" ||
      capability === "open_door" ||
      capability === "stop_follow" ||
      capability === "stop_movement" ||
      capability === "swing_arm" ||
      capability === "use_held_item" ||
      capability === "walk_forward"
    );
  }

  async sendChat(message: string): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    bot.chat(message);
    return {
      ok: true,
      detail: `sent chat: ${message}`
    };
  }

  async waitForChatEcho(expectedSender: string, expectedMessage: string, timeoutMs: number): Promise<boolean> {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return false;

    return await new Promise<boolean>((resolve) => {
      let done = false;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        bot.off("chat", onChat);
        bot.off("messagestr", onMessageStr);
        resolve(ok);
      };
      const onChat = (username: string, message: string): void => {
        if (username === expectedSender && message === expectedMessage) finish(true);
      };
      const onMessageStr = (message: string): void => {
        const parsed = /^<([^>]+)>\s*(.*)$/.exec((message || "").trim());
        if (parsed && parsed[1] === expectedSender && parsed[2] === expectedMessage) finish(true);
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      bot.on("chat", onChat);
      bot.on("messagestr", onMessageStr);
    });
  }

  subscribeChatEvents(handler: ClientChatEventHandler): () => void {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return () => {};

    const onChat = (username: string, message: string): void => {
      handler({ username, message, source: "chat" });
    };
    const onMessageStr = (message: string): void => {
      const parsed = /^<([^>]+)>\s*(.*)$/.exec((message || "").trim());
      if (parsed) handler({ username: parsed[1], message: parsed[2], source: "messagestr" });
    };

    bot.on("chat", onChat);
    bot.on("messagestr", onMessageStr);
    const unsubscribe = (): void => {
      bot.off("chat", onChat);
      bot.off("messagestr", onMessageStr);
      this.chatSubscriptions.delete(unsubscribe);
    };
    this.chatSubscriptions.add(unsubscribe);
    return unsubscribe;
  }

  subscribeEntityEvents(handler: ClientEntityEventHandler): () => void {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return () => {};

    const onEntityDead = (entity: unknown): void => {
      const rawEntity = (typeof entity === "object" && entity !== null ? entity : {}) as {
        id?: unknown;
        name?: unknown;
        username?: unknown;
        type?: unknown;
        displayName?: unknown;
        kind?: unknown;
        position?: { x: number; y: number; z: number };
      };
      const name = [rawEntity.name, rawEntity.username, rawEntity.type]
        .find((value): value is string => typeof value === "string" && value.length > 0) ?? "unknown";
      handler({
        type: "entity_dead",
        entity: {
          entityId: typeof rawEntity.id === "number" ? rawEntity.id : undefined,
          name,
          displayName: typeof rawEntity.displayName === "string" ? rawEntity.displayName : null,
          type: typeof rawEntity.type === "string" ? rawEntity.type : "unknown",
          kind: typeof rawEntity.kind === "string" ? rawEntity.kind : null,
          position: toPositionSnapshot(rawEntity.position)
        }
      });
    };
    const onSelfDeath = (): void => {
      handler({ type: "self_death" });
    };

    bot.on("entityDead", onEntityDead);
    bot.on("death", onSelfDeath);
    let active = true;
    const unsubscribe = (): void => {
      if (!active) return;
      active = false;
      bot.off("entityDead", onEntityDead);
      bot.off("death", onSelfDeath);
      this.entitySubscriptions.delete(unsubscribe);
    };
    this.entitySubscriptions.add(unsubscribe);
    return unsubscribe;
  }

  subscribeMovementEvents(handler: ClientMovementEventHandler): () => void {
    if (!this.getNativeMineflayerBot()) return () => {};

    let active = true;
    const unsubscribe = (): void => {
      if (!active) return;
      active = false;
      this.movementEventHandlers.delete(handler);
      this.movementSubscriptions.delete(unsubscribe);
    };
    this.movementEventHandlers.add(handler);
    this.movementSubscriptions.add(unsubscribe);
    return unsubscribe;
  }

  getSelfState(): SelfStateSnapshot | null {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return null;
    return {
      username: bot.username,
      position: toPositionSnapshot(bot.entity?.position),
      yaw: typeof bot.entity?.yaw === "number" ? bot.entity.yaw : undefined,
      pitch: typeof bot.entity?.pitch === "number" ? bot.entity.pitch : undefined,
      onGround: typeof bot.entity?.onGround === "boolean" ? bot.entity.onGround : undefined,
      velocity: toPositionSnapshot(bot.entity?.velocity),
      health: typeof bot.health === "number" ? bot.health : undefined,
      food: typeof bot.food === "number" ? bot.food : undefined,
      oxygenLevel: typeof bot.oxygenLevel === "number" ? bot.oxygenLevel : undefined,
      dimension: bot.game?.dimension ?? undefined,
      gameMode: typeof bot.game?.gameMode === "string" ? bot.game.gameMode : undefined,
      difficulty: typeof bot.game?.difficulty === "string" ? bot.game.difficulty : undefined
    };
  }

  getPlayerSnapshot(username: string): PlayerSnapshot | null {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return null;
    const player = bot.players[username];
    if (!player) return null;
    return {
      username,
      position: toPositionSnapshot(player.entity?.position)
    };
  }

  getNearbyPlayers(radius = 32): PlayerSnapshot[] {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return [];
    const me = bot.entity?.position;
    if (!me) return [];

    return Object.values(bot.players)
      .filter((player) => player.entity && player.username !== bot.username)
      .map((player) => {
        const distance = player.entity?.position ? Number(player.entity.position.distanceTo(me).toFixed(2)) : undefined;
        return {
          username: player.username,
          entityId: typeof player.entity?.id === "number" ? player.entity.id : undefined,
          uuid: player.uuid,
          distance,
          position: toPositionSnapshot(player.entity?.position)
        } satisfies PlayerSnapshot;
      })
      .filter((player) => (player.distance ?? Number.POSITIVE_INFINITY) <= radius)
      .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));
  }

  getNearbyEntities(radius = 24): EntitySnapshot[] {
    const bot = this.getNativeMineflayerBot();
    if (!bot) return [];
    const me = bot.entity?.position;
    if (!me) return [];

    return Object.values(bot.entities as Record<string, any>)
      .filter((entity) => entity && entity !== bot.entity)
      .map((entity) => {
        const distance = entity.position ? Number(entity.position.distanceTo(me).toFixed(2)) : undefined;
        return {
          entityId: typeof entity.id === "number" ? entity.id : undefined,
          name: entity.name || entity.username || entity.type || "unknown",
          displayName: entity.displayName || null,
          type: entity.type || "unknown",
          kind: entity.kind || null,
          distance,
          position: toPositionSnapshot(entity.position)
        } satisfies EntitySnapshot;
      })
      .filter((entity) => (entity.distance ?? Number.POSITIVE_INFINITY) <= radius)
      .sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY));
  }

  getBlockObservation(reach = 4): BlockObservationSnapshot {
    const bot = this.getNativeMineflayerBot();
    if (!bot?.entity?.position) {
      return {
        feet: null,
        inSight: null
      };
    }
    const feet = bot.blockAt(bot.entity.position.offset(0, -1, 0));
    const inSight = bot.blockAtCursor(reach);
    return {
      feet: toBlockSnapshot(feet),
      inSight: toBlockSnapshot(inSight)
    };
  }

  getInventoryState(includeSlots = false): InventorySnapshot {
    const bot = this.getNativeMineflayerBot();
    if (!bot) {
      return {
        heldItem: null,
        armor: {
          head: null,
          torso: null,
          legs: null,
          feet: null
        },
        items: [],
        slots: includeSlots ? [] : undefined
      };
    }

    return {
      heldItem: toInventoryEntrySnapshot(bot.heldItem),
      armor: {
        head: toInventoryEntrySnapshot(bot.inventory.slots[5]),
        torso: toInventoryEntrySnapshot(bot.inventory.slots[6]),
        legs: toInventoryEntrySnapshot(bot.inventory.slots[7]),
        feet: toInventoryEntrySnapshot(bot.inventory.slots[8])
      },
      items: bot.inventory.items().map((item) => toInventoryEntrySnapshot(item)).filter((item): item is InventoryEntrySnapshot => item !== null),
      slots: includeSlots
        ? bot.inventory.slots.map((item, slot) => ({
            slot,
            item: toInventoryEntrySnapshot(item)
          }))
        : undefined
    };
  }

  private async ensureCombatWeaponEquipped(bot: mineflayer.Bot): Promise<string | null> {
    const weapon = findBestWeaponItem(bot.inventory.items());
    if (!weapon) return bot.heldItem?.name ?? null;
    await bot.equip(weapon, "hand");
    return weapon.name ?? null;
  }

  private async attackEntityOnce(bot: mineflayer.Bot, target: any): Promise<void> {
    await this.ensureCombatWeaponEquipped(bot);
    this.combatHitCounter += 1;
    const doCritical = this.combatHitCounter % 4 !== 0;

    await bot.lookAt(target.position.offset(0, 1.2, 0), true);
    if (doCritical) {
      bot.setControlState("jump", true);
      await new Promise((resolve) => setTimeout(resolve, 120));
      bot.setControlState("jump", false);
      await new Promise((resolve) => setTimeout(resolve, 90));
    }
    bot.attack(target);
  }

  async attackEntity(input: AttackEntityInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    if (!Number.isInteger(input.entityId) || input.entityId < 0) {
      throw new Error("attackEntity requires a non-negative integer entityId");
    }
    const maxDistance = input.maxDistance ?? 4.5;
    if (!Number.isFinite(maxDistance) || maxDistance <= 0) {
      throw new Error("attackEntity maxDistance must be greater than zero");
    }
    const target = bot.entities[input.entityId];
    if (!target || target === bot.entity) {
      throw new Error(`Entity '${input.entityId}' not found nearby`);
    }
    const distance = bot.entity.position.distanceTo(target.position);
    if (distance > maxDistance) {
      throw new Error(`Entity '${input.entityId}' is too far (${distance.toFixed(2)} > ${maxDistance})`);
    }

    await this.attackEntityOnce(bot, target);
    return {
      ok: true,
      detail: `attacked entity id=${input.entityId}, distance=${distance.toFixed(2)}`
    };
  }

  async attackPlayer(input: AttackPlayerInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const maxDistance = input.maxDistance ?? 4.5;
    const target = bot.players[input.playerName]?.entity;
    if (!target) {
      throw new Error(`Player '${input.playerName}' not found nearby`);
    }

    const distance = bot.entity.position.distanceTo(target.position);
    if (distance > maxDistance) {
      throw new Error(`Player '${input.playerName}' is too far (${distance.toFixed(2)} > ${maxDistance})`);
    }

    await this.attackEntityOnce(bot, target);
    return {
      ok: true,
      detail: `attacked player '${input.playerName}' at distance ${distance.toFixed(2)}`
    };
  }

  async attackNearestEntity(input: AttackNearestEntityInput = {}): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const maxDistance = input.maxDistance ?? 4.5;
    const typeFilter = input.type?.trim().toLowerCase();
    const nameFilter = input.name?.trim().toLowerCase();
    const includePlayers = input.includePlayers ?? false;
    const me = bot.entity.position;

    const target = Object.values(bot.entities as Record<string, any>)
      .filter((entity) => entity && entity !== bot.entity)
      .filter((entity) => includePlayers || entity.type !== "player")
      .map((entity) => ({
        entity,
        distance: entity.position.distanceTo(me),
        joined: `${entity.type} ${entity.name ?? ""} ${entity.displayName ?? ""} ${entity.kind ?? ""}`.toLowerCase()
      }))
      .filter((candidate) => candidate.distance <= maxDistance)
      .filter((candidate) => (typeFilter ? candidate.joined.includes(typeFilter) : true))
      .filter((candidate) => (nameFilter ? candidate.joined.includes(nameFilter) : true))
      .sort((a, b) => a.distance - b.distance)[0];

    if (!target) {
      throw new Error("No matching entity found in range");
    }

    await this.attackEntityOnce(bot, target.entity);
    return {
      ok: true,
      detail: `attacked entity id=${target.entity.id}, type=${target.entity.type}, name=${target.entity.name ?? "unknown"}, distance=${target.distance.toFixed(2)}`
    };
  }

  async pursueEntity(input: PursueEntityInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    if (!Number.isInteger(input.entityId) || input.entityId < 0) {
      throw new Error("pursueEntity requires a non-negative integer entityId");
    }
    const stopDistance = input.stopDistance ?? 2;
    if (!Number.isFinite(stopDistance) || stopDistance <= 0) {
      throw new Error("pursueEntity stopDistance must be greater than zero");
    }
    const movementId = this.resolveMovementId(input.movementId, "pursue_entity");
    const target = bot.entities[input.entityId];
    if (!target || target === bot.entity) {
      throw new Error(`Entity '${input.entityId}' not found nearby`);
    }

    this.supersedeActivePathAssessment();
    const pathApi = ensureSafePathfinder(bot);
    const module = getPathfinderModule();
    const GoalNearCtor = module.goals?.GoalNear ?? module.default?.goals?.GoalNear;
    if (!pathApi || !GoalNearCtor) {
      forceStopMovement(bot);
      throw new SafePathError("pathfinder_unavailable", "entity pursuit");
    }

    const range = Math.max(1, Math.floor(stopDistance));
    const assessment = await this.waitForInitialSafePath(
      bot,
      pathApi,
      new GoalNearCtor(
        Math.floor(target.position.x),
        Math.floor(target.position.y),
        Math.floor(target.position.z),
        range
      ),
      () => bot.entities[input.entityId]?.position ?? target.position,
      true,
      "entity pursuit",
      "pursue_entity",
      movementId
    );
    if (assessment === "accepted") {
      bot.setControlState("sprint", input.sprint ?? true);
      bot.setControlState("forward", false);
      bot.setControlState("jump", false);
    }
    return {
      ok: true,
      detail: assessment === "accepted"
        ? `pursuing entity id=${input.entityId} with pathfinder (stopDistance=${range})`
        : `entity pursuit id=${input.entityId} was superseded before initial path assessment`
    };
  }

  private waitForInitialSafePath(
    bot: mineflayer.Bot,
    pathApi: PathfinderApi,
    goal: unknown,
    getTargetPosition: () => { x: number; y: number; z: number },
    dynamic: boolean,
    context: string,
    action: ClientMovementAction,
    movementId: string
  ): Promise<InitialPathAssessmentResult> {
    this.supersedeActivePathAssessment();

    return new Promise<InitialPathAssessmentResult>((resolve, reject) => {
      let initialSettled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = (): void => {
        bot.off("path_update", onPathUpdate);
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (this.activePathAssessment === activeAssessment) {
          this.activePathAssessment = null;
        }
      };
      const finish = (result: InitialPathAssessmentResult): void => {
        if (initialSettled) return;
        initialSettled = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (result === "superseded") cleanup();
        resolve(result);
      };
      const failInitial = (reason: ClientMovementFailureReason): void => {
        if (initialSettled) return;
        initialSettled = true;
        cleanup();
        forceStopMovement(bot);
        reject(new SafePathError(reason, "initial route is unavailable or unsafe"));
      };
      const failContinuous = (reason: ClientMovementFailureReason): void => {
        if (!initialSettled || this.activePathAssessment !== activeAssessment) return;
        cleanup();
        forceStopMovement(bot);
        this.emitMovementFailure({
          movementId,
          action,
          reason,
          detail: `safe path ${reason}: continuous route is unavailable or unsafe`
        });
      };
      const onPathUpdate = (update: PathfinderPathUpdate): void => {
        try {
          const assessment = assessSafePathUpdate(
            bot.entity.position,
            getTargetPosition(),
            update.status,
            update.path
          );
          if (assessment.outcome === "approach_unreachable") {
            const reason = assessment.reason === "approach_timeout"
              ? "path_timeout"
              : assessment.reason ?? "no_path";
            if (initialSettled) failContinuous(reason);
            else failInitial(reason);
            return;
          }
          if (update.status === "success") finish("accepted");
        } catch {
          if (initialSettled) failContinuous("no_path");
          else failInitial("no_path");
        }
      };
      const activeAssessment: ActivePathAssessment = {
        supersede: () => {
          if (initialSettled) cleanup();
          else finish("superseded");
        }
      };

      this.activePathAssessment = activeAssessment;
      bot.on("path_update", onPathUpdate);
      timer = setTimeout(() => failInitial("path_timeout"), INITIAL_PATH_ASSESSMENT_TIMEOUT_MS);
      try {
        pathApi.setGoal(goal, dynamic);
      } catch {
        if (initialSettled) {
          failContinuous("goal_rejected");
        } else {
          initialSettled = true;
          cleanup();
          forceStopMovement(bot);
          reject(new SafePathError("goal_rejected", context));
        }
      }
    });
  }

  private supersedeActivePathAssessment(): void {
    this.activePathAssessment?.supersede();
  }

  private async approachMiningBlock(
    bot: mineflayer.Bot,
    targetPosition: MiningPosition,
    reachDistance: number,
    timeoutMs: number
  ): Promise<MiningApproachResult> {
    const pathApi = ensureSafePathfinder(bot);
    const module = getPathfinderModule();
    const GoalNearCtor = module.goals?.GoalNear ?? module.default?.goals?.GoalNear;
    if (!pathApi || !GoalNearCtor) return { outcome: "pathfinder_unavailable" };

    const goal = new GoalNearCtor(
      Math.floor(targetPosition.x),
      Math.floor(targetPosition.y),
      Math.floor(targetPosition.z),
      Math.max(1, Math.floor(reachDistance - 1))
    );

    return new Promise<MiningApproachResult>((resolve) => {
      let settled = false;
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

      const clearPath = (): void => {
        try {
          pathApi.setGoal(null);
          if (typeof pathApi.stop === "function") pathApi.stop();
        } catch {
          // The connection may have closed while the approach was active.
        }
        for (const key of WALK_STATES) bot.setControlState(key, false);
      };
      const finish = (result: MiningApproachResult): void => {
        if (settled) return;
        settled = true;
        if (pollTimer) clearInterval(pollTimer);
        if (timeoutTimer) clearTimeout(timeoutTimer);
        bot.off("path_update", onPathUpdate);
        clearPath();
        resolve(result);
      };
      const onPathUpdate = (update: PathfinderPathUpdate): void => {
        try {
          const assessment = assessMiningPathUpdate(
            bot.entity.position,
            targetPosition,
            update.status,
            update.path
          );
          if (assessment.outcome === "approach_unreachable") {
            finish({ outcome: "approach_unreachable", reason: assessment.reason });
          }
        } catch {
          finish({ outcome: "approach_unreachable", reason: "no_path" });
        }
      };

      bot.on("path_update", onPathUpdate);
      pollTimer = setInterval(() => {
        if (miningPositionDistance(bot.entity.position, targetPosition) <= reachDistance) {
          finish({ outcome: "reached" });
        }
      }, 100);
      timeoutTimer = setTimeout(() => {
        finish({ outcome: "approach_unreachable", reason: "approach_timeout" });
      }, timeoutMs);

      try {
        pathApi.setGoal(goal, false);
      } catch {
        finish({ outcome: "pathfinder_unavailable" });
      }
    });
  }

  async mineBlock(input: MineBlockInput): Promise<MineBlockResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const miningBot = bot as unknown as MineflayerMiningClient;
    const target: BlockSnapshot = {
      name: input.target.name.trim(),
      displayName: input.target.displayName ?? null,
      position: { ...input.target.position }
    };
    const reachDistance = input.reachDistance ?? 4.5;
    const moveNear = input.moveNear ?? true;
    const requireVisible = input.requireVisible ?? true;
    const visibleStep = input.visibleStep ?? 0.2;
    const approachTimeoutMs = input.approachTimeoutMs ?? 20_000;
    if (!target.name) throw new Error("mineBlock target name is required");
    if (![target.position.x, target.position.y, target.position.z].every(Number.isFinite)) {
      throw new Error("mineBlock target requires finite x/y/z coordinates");
    }
    if (!Number.isFinite(reachDistance) || reachDistance <= 0) {
      throw new Error("mineBlock reachDistance must be greater than zero");
    }
    if (!Number.isFinite(visibleStep) || visibleStep <= 0 || visibleStep > 0.5) {
      throw new Error("mineBlock visibleStep must be greater than zero and at most 0.5");
    }
    if (!Number.isFinite(approachTimeoutMs) || approachTimeoutMs <= 0) {
      throw new Error("mineBlock approachTimeoutMs must be greater than zero");
    }

    const targetPosition = miningBot.entity.position.offset(
      target.position.x - miningBot.entity.position.x,
      target.position.y - miningBot.entity.position.y,
      target.position.z - miningBot.entity.position.z
    );
    const initialDistance = miningPositionDistance(miningBot.entity.position, targetPosition);
    const result = (
      outcome: MineBlockResult["outcome"],
      detail: string,
      options: { equippedTool?: string | null; approachFailureReason?: MiningApproachFailureReason } = {}
    ): MineBlockResult => ({
      ok: outcome === "mined",
      outcome,
      detail,
      block: target,
      initialDistance,
      finalDistance: miningPositionDistance(miningBot.entity.position, targetPosition),
      ...options
    });
    const readTargetBlock = (): MineflayerMiningBlock | null => miningBot.blockAt(targetPosition);
    const validateTargetBlock = (): MineBlockResult | MineflayerMiningBlock => {
      const block = readTargetBlock();
      if (!block || block.type === 0) return result("target_missing", "target block is missing");
      if (block.name !== target.name) {
        return result("target_changed", `target changed from ${target.name} to ${block.name}`);
      }
      return block;
    };

    const initialBlock = validateTargetBlock();
    if ("outcome" in initialBlock) return initialBlock;

    if (moveNear && initialDistance > reachDistance) {
      const approach = await this.approachMiningBlock(bot, targetPosition, reachDistance, approachTimeoutMs);
      if (approach.outcome === "pathfinder_unavailable") {
        return result("pathfinder_unavailable", "pathfinder is unavailable for mining approach");
      }
      if (approach.outcome === "approach_unreachable") {
        return result("approach_unreachable", `mining target is unreachable (${approach.reason ?? "unknown"})`, {
          approachFailureReason: approach.reason
        });
      }
    }

    const latest = validateTargetBlock();
    if ("outcome" in latest) return latest;
    if (requireVisible && !canSeeBlockByRay(miningBot, latest, visibleStep)) {
      return result("not_visible", "target is no longer visible");
    }
    if (!miningBot.canDigBlock(latest)) {
      return result("cannot_dig", `cannot dig ${latest.name} from the current position`);
    }

    const equipped = await equipBestToolForBlock(miningBot, latest);
    await miningBot.lookAt(latest.position.offset(0.5, 0.5, 0.5), true);
    await miningBot.dig(latest, true);
    return result("mined", `dug ${latest.name}`, { equippedTool: equipped.tool });
  }

  async moveTo(input: MoveToInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const stopRadius = input.stopRadius ?? 2.3;
    const decision = decidePositionMovement(bot.entity.position, input, stopRadius);
    const movementId = this.resolveMovementId(input.movementId, "move_to_position");
    if (decision.status === "arrived") {
      this.supersedeActivePathAssessment();
      const pathApi = bot.pathfinder as unknown as PathfinderApi | undefined;
      if (pathApi && typeof pathApi.setGoal === "function") {
        pathApi.setGoal(null);
        if (typeof pathApi.stop === "function") pathApi.stop();
      }
      for (const key of WALK_STATES) {
        bot.setControlState(key, false);
      }
      return {
        ok: true,
        detail: `already within stop radius (${decision.distance.toFixed(2)} <= ${stopRadius})`
      };
    }

    this.supersedeActivePathAssessment();
    const pathApi = ensureSafePathfinder(bot);
    const module = getPathfinderModule();
    const GoalNearCtor = module.goals?.GoalNear ?? module.default?.goals?.GoalNear;
    if (!pathApi || !GoalNearCtor) {
      forceStopMovement(bot);
      throw new SafePathError("pathfinder_unavailable", "fixed-position movement");
    }

    const range = Math.max(1, Math.floor(stopRadius));
    const assessment = await this.waitForInitialSafePath(
      bot,
      pathApi,
      new GoalNearCtor(
        Math.floor(input.x),
        Math.floor(input.y),
        Math.floor(input.z),
        range
      ),
      () => input,
      true,
      "fixed-position movement",
      "move_to_position",
      movementId
    );
    if (assessment === "accepted") {
      bot.setControlState("sprint", decision.pathfinderSprint);
      bot.setControlState("forward", false);
      bot.setControlState("jump", false);
    }
    return {
      ok: true,
      detail: assessment === "accepted"
        ? `moving to ${input.x},${input.y},${input.z} with pathfinder (stopRadius=${range})`
        : `fixed-position movement was superseded before initial path assessment`
    };
  }

  async look(yaw: number, pitch: number, force = true): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    await bot.look(yaw, pitch, force);
    return {
      ok: true,
      detail: `look set to yaw=${yaw}, pitch=${pitch}`
    };
  }

  async dropHeldItem(mode: ClientAdapterDropMode = "one"): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const held = bot.heldItem;
    if (!held) {
      throw new Error("No held item to drop");
    }

    if (mode === "one") {
      await tossSingle(bot, held);
      return {
        ok: true,
        detail: `dropped one ${held.name} from hand`
      };
    }

    await tossWholeStack(bot, held);
    return {
      ok: true,
      detail: `dropped stack ${held.name} from hand`
    };
  }

  async dropHotbarSlot(input: DropHotbarSlotInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const slot = input.slot;
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      throw new Error("interact.dropHotbarSlot requires integer slot 1-9");
    }

    const previousSlot = (bot.quickBarSlot ?? 0) + 1;
    await selectHotbarSlot(bot, slot);
    const held = bot.heldItem;
    if (!held) {
      if (input.restorePrevious !== false) {
        await selectHotbarSlot(bot, previousSlot);
      }
      throw new Error(`Hotbar slot ${slot} is empty`);
    }

    const mode = input.mode === "stack" ? "stack" : "one";
    if (mode === "one") {
      await tossSingle(bot, held);
    } else {
      await tossWholeStack(bot, held);
    }

    if (input.restorePrevious !== false) {
      await selectHotbarSlot(bot, previousSlot);
    }

    return {
      ok: true,
      detail: `dropped ${mode} from hotbar slot ${slot}`
    };
  }

  async holdHotbarSlot(input: HoldHotbarSlotInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const slot = input.slot;
    if (!Number.isInteger(slot) || slot < 1 || slot > 9) {
      throw new Error("inventory.holdSlot requires integer slot 1-9");
    }

    await selectHotbarSlot(bot, slot);
    return {
      ok: true,
      detail: `selected hotbar slot ${slot} (held=${bot.heldItem?.name ?? "empty"})`
    };
  }

  async holdItemByCategory(input: HoldItemByCategoryInput): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const best = findBestCategoryItem(bot.inventory.items(), input.category);
    if (!best) {
      throw new Error(`No item found for category '${input.category}'`);
    }

    await bot.equip(best, "hand");
    return {
      ok: true,
      detail: `equipped ${best.name} for category '${input.category}'`
    };
  }

  async organizeHotbar(): Promise<OrganizeHotbarResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const plan = buildHotbarOrganizationPlan(this.getInventoryState(true).slots ?? []);
    for (const move of plan.moves) {
      await moveInventorySlot(bot, move.fromSlot, move.toSlot);
    }
    await selectHotbarSlot(bot, plan.selectedHotbarSlot);

    const failedCount = plan.actions.filter((action) => action.status === "failed_no_empty_slot").length;
    return {
      ok: true,
      detail: `organized hotbar with ${plan.moves.length} slot moves (${failedCount} blocked)`,
      actions: plan.actions
    };
  }

  async eatFood(input: EatFoodInput = {}): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const items = bot.inventory.items();
    const foodItem = input.itemName
      ? items.find((item) => item.name === input.itemName && isFoodItemName(item.name)) ?? null
      : getBestFoodItem(items);

    if (!foodItem) {
      throw new Error(input.itemName ? `Food item '${input.itemName}' not found in inventory` : "No edible item found in inventory");
    }

    await bot.equip(foodItem, "hand");
    await bot.consume();
    return {
      ok: true,
      detail: `ate '${foodItem.name}'`
    };
  }

  async walkForward(input: WalkForwardInput = {}): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    bot.setControlState("sprint", input.sprint ?? false);
    bot.setControlState("jump", input.jump ?? false);
    bot.setControlState("forward", true);
    return {
      ok: true,
      detail: `walking forward (sprint=${input.sprint ?? false}, jump=${input.jump ?? false})`
    };
  }

  async swingArm(arm: "right" | "left" = "right"): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    bot.swingArm(arm);
    return {
      ok: true,
      detail: `swung ${arm} arm`
    };
  }

  async useHeldItem(input: UseItemInput = {}): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const mode = input.mode ?? "tap";
    const reach = input.reach ?? 4.5;
    const preferBlockInteraction = input.preferBlockInteraction ?? true;

    if (mode === "tap") {
      const target = bot.blockAtCursor(reach);
      if (target && preferBlockInteraction) {
        await bot.activateBlock(target);
        return {
          ok: true,
          detail: `right-click tap interacted with block '${target.name}' at ${target.position}`
        };
      }

      bot.activateItem();
      bot.deactivateItem();
      return {
        ok: true,
        detail: "right-click tap used held item once"
      };
    }

    const holdMs = input.holdMs ?? 1200;
    bot.activateItem();
    await new Promise((resolve) => setTimeout(resolve, holdMs));
    bot.deactivateItem();
    return {
      ok: true,
      detail: `right-click hold finished (holdMs=${holdMs})`
    };
  }

  async openDoor(input: OpenDoorInput = {}): Promise<ActionResult> {
    const bot = this.getNativeMineflayerBotOrThrow();
    const reach = input.reach ?? 4.5;
    const radius = input.radius ?? 6;

    const cursorBlock = bot.blockAtCursor(reach);
    if (cursorBlock && isDoorBlockName(cursorBlock.name)) {
      await bot.activateBlock(cursorBlock);
      return {
        ok: true,
        detail: `toggled door '${cursorBlock.name}' at ${cursorBlock.position}`
      };
    }

    const doorIds = Object.values(bot.registry.blocksByName)
      .filter((block) => isDoorBlockName(block.name))
      .map((block) => block.id);
    const positions = bot.findBlocks({
      matching: (block) => doorIds.includes(block.type),
      maxDistance: radius,
      count: 1
    });

    if (positions.length === 0) {
      throw new Error(`No door block found within radius ${radius}`);
    }

    const door = bot.blockAt(positions[0]);
    if (!door) {
      throw new Error("Door block vanished before interaction");
    }

    await bot.activateBlock(door);
    return {
      ok: true,
      detail: `toggled nearest door '${door.name}' at ${door.position}`
    };
  }

  async stopMovement(): Promise<ActionResult> {
    this.supersedeActivePathAssessment();
    const bot = this.getNativeMineflayerBotOrThrow();
    const pathApi = (bot as any).pathfinder;
    if (pathApi && typeof pathApi.setGoal === "function") {
      pathApi.setGoal(null);
      if (typeof pathApi.stop === "function") pathApi.stop();
    }
    for (const key of WALK_STATES) {
      bot.setControlState(key, false);
    }
    return {
      ok: true,
      detail: "stopped movement"
    };
  }

  getNativeMineflayerBot(): mineflayer.Bot | null {
    return this.bot;
  }

  getNativeMineflayerBotOrThrow(): mineflayer.Bot {
    if (!this.bot) {
      throw new Error("Mineflayer bot is not available");
    }
    return this.bot;
  }

  setRuntimeState(state: RuntimeState): void {
    this.runtimeState = state;
  }

  clearBotReference(): void {
    this.supersedeActivePathAssessment();
    this.clearChatSubscriptions();
    this.clearEntitySubscriptions();
    this.clearMovementSubscriptions();
    this.bot = null;
  }

  private clearChatSubscriptions(): void {
    for (const unsubscribe of [...this.chatSubscriptions]) unsubscribe();
  }

  private clearEntitySubscriptions(): void {
    for (const unsubscribe of [...this.entitySubscriptions]) unsubscribe();
  }

  private clearMovementSubscriptions(): void {
    for (const unsubscribe of [...this.movementSubscriptions]) unsubscribe();
  }

  private resolveMovementId(value: string | undefined, action: ClientMovementAction): string {
    if (value === undefined) {
      this.movementSequence += 1;
      return `${action}:${this.movementSequence}`;
    }
    const movementId = value.trim();
    const hasControlCharacter = [...movementId].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    });
    if (!movementId || movementId.length > 200 || hasControlCharacter) {
      throw new Error("movementId must be 1-200 characters without control characters");
    }
    return movementId;
  }

  private emitMovementFailure(event: Omit<ClientMovementFailedEvent, "type">): void {
    for (const handler of [...this.movementEventHandlers]) {
      try {
        handler({ type: "movement_failed", ...event });
      } catch {
        // One observer must not prevent cleanup or notification of other observers.
      }
    }
  }
}
