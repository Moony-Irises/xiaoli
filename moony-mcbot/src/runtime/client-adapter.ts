import { AuthSession, BotConfig, RuntimeState } from "../types.js";

export type ClientAdapterKind = "mineflayer" | "modded-client";
export type ClientAdapterDropMode = "one" | "stack";
export type HeldItemCategory = "sword" | "axe" | "pickaxe" | "food";
export type ClientCapability =
  | "attack_entity"
  | "attack_nearest_entity"
  | "attack_player"
  | "drop_held_item"
  | "drop_hotbar_slot"
  | "eat_food"
  | "hold_hotbar_slot"
  | "hold_item_by_category"
  | "mine_block"
  | "organize_hotbar"
  | "move_to_position"
  | "pursue_entity"
  | "send_chat"
  | "follow_player"
  | "look"
  | "open_door"
  | "stop_follow"
  | "stop_movement"
  | "swing_arm"
  | "use_held_item"
  | "walk_forward";

export const CLIENT_CAPABILITIES: readonly ClientCapability[] = [
  "attack_entity",
  "attack_nearest_entity",
  "attack_player",
  "drop_held_item",
  "drop_hotbar_slot",
  "eat_food",
  "hold_hotbar_slot",
  "hold_item_by_category",
  "mine_block",
  "organize_hotbar",
  "move_to_position",
  "pursue_entity",
  "send_chat",
  "follow_player",
  "look",
  "open_door",
  "stop_follow",
  "stop_movement",
  "swing_arm",
  "use_held_item",
  "walk_forward"
];

export interface ClientConnectionState {
  kind: ClientAdapterKind;
  runtimeState: RuntimeState;
  connected: boolean;
}

export interface ClientAdapterStatus {
  kind: ClientAdapterKind;
  connection: ClientConnectionState;
  capabilities: Record<ClientCapability, boolean>;
  recentActions: ClientAdapterActionRecord[];
}

export interface SelfStateSnapshot {
  username?: string;
  position?: { x: number; y: number; z: number };
  yaw?: number;
  pitch?: number;
  onGround?: boolean;
  velocity?: { x: number; y: number; z: number };
  health?: number;
  food?: number;
  oxygenLevel?: number;
  dimension?: string;
  gameMode?: string;
  difficulty?: string;
}

export interface InventoryEntrySnapshot {
  name: string;
  displayName?: string | null;
  count: number;
  slot?: number;
}

export interface ArmorSnapshot {
  head: InventoryEntrySnapshot | null;
  torso: InventoryEntrySnapshot | null;
  legs: InventoryEntrySnapshot | null;
  feet: InventoryEntrySnapshot | null;
}

export interface InventorySnapshot {
  heldItem: InventoryEntrySnapshot | null;
  armor: ArmorSnapshot;
  items: InventoryEntrySnapshot[];
  slots?: Array<{
    slot: number;
    item: InventoryEntrySnapshot | null;
  }>;
}

export interface PlayerSnapshot {
  username: string;
  entityId?: number;
  uuid?: string;
  distance?: number;
  position?: { x: number; y: number; z: number };
}

export interface EntitySnapshot {
  entityId?: number;
  name?: string;
  displayName?: string | null;
  type?: string;
  kind?: string | null;
  distance?: number;
  position?: { x: number; y: number; z: number };
}

export interface BlockSnapshot {
  name: string;
  displayName?: string | null;
  position: { x: number; y: number; z: number };
}

export interface BlockObservationSnapshot {
  feet: BlockSnapshot | null;
  inSight: BlockSnapshot | null;
}

export interface ActionResult {
  ok: boolean;
  detail?: string;
}

export type HotbarOrganizationStatus = "moved" | "missing" | "failed_no_empty_slot";

export interface HotbarOrganizationAction {
  category: HeldItemCategory;
  status: HotbarOrganizationStatus;
  item?: string;
  fromSlot?: number;
  toHotbar?: number;
}

export interface OrganizeHotbarResult extends ActionResult {
  actions: HotbarOrganizationAction[];
}

export interface ClientAdapterActionRecord {
  action: string;
  timestamp: string;
  ok: boolean;
  detail?: string;
  error?: string;
}

export interface ContainerSession {
  kind: string;
  title?: string;
  close(): Promise<void>;
}

export interface FollowPlayerInput {
  playerName: string;
  minDistance?: number;
  maxDistance?: number;
  sprint?: boolean;
  tickMs?: number;
}

export interface WalkForwardInput {
  sprint?: boolean;
  jump?: boolean;
}

export interface DropHotbarSlotInput {
  slot: number;
  mode?: ClientAdapterDropMode;
  restorePrevious?: boolean;
}

export interface EatFoodInput {
  itemName?: string;
}

export interface HoldHotbarSlotInput {
  slot: number;
}

export interface HoldItemByCategoryInput {
  category: HeldItemCategory;
}

export interface MoveToInput {
  x: number;
  y: number;
  z: number;
  stopRadius?: number;
  movementId?: string;
}

export type MineBlockOutcome =
  | "mined"
  | "target_missing"
  | "target_changed"
  | "not_visible"
  | "cannot_dig"
  | "pathfinder_unavailable"
  | "approach_unreachable";

export interface MineBlockInput {
  target: BlockSnapshot;
  reachDistance?: number;
  moveNear?: boolean;
  requireVisible?: boolean;
  visibleStep?: number;
  approachTimeoutMs?: number;
}

export interface MineBlockResult extends ActionResult {
  outcome: MineBlockOutcome;
  block: BlockSnapshot;
  initialDistance: number;
  finalDistance: number;
  equippedTool?: string | null;
  approachFailureReason?: "no_path" | "path_timeout" | "detour_too_long" | "approach_timeout";
}

export interface LookAtInput {
  x: number;
  y: number;
  z: number;
  force?: boolean;
}

export interface AttackInput {
  targetText?: string;
  reach?: number;
}

export interface AttackEntityInput {
  entityId: number;
  maxDistance?: number;
}

export interface PursueEntityInput {
  entityId: number;
  stopDistance?: number;
  sprint?: boolean;
  jump?: boolean;
  movementId?: string;
}

export interface AttackPlayerInput {
  playerName: string;
  maxDistance?: number;
}

export interface AttackNearestEntityInput {
  maxDistance?: number;
  type?: string;
  name?: string;
  includePlayers?: boolean;
}

export interface UseItemInput {
  mode?: "tap" | "hold";
  holdMs?: number;
  reach?: number;
  preferBlockInteraction?: boolean;
}

export interface OpenDoorInput {
  reach?: number;
  radius?: number;
}

export interface OpenContainerInput {
  reach?: number;
  searchRadius?: number;
}

export interface VisibleBlockQuery {
  names?: string[];
  radius?: number;
}

export interface ClientAdapterConnectContext {
  config: BotConfig;
  session: AuthSession;
}

export type ClientChatEventSource = "chat" | "messagestr";

export interface ClientChatEvent {
  username: string;
  message: string;
  source: ClientChatEventSource;
}

export type ClientChatEventHandler = (event: ClientChatEvent) => void;

export type ClientEntityEvent =
  | {
      type: "entity_dead";
      entity: EntitySnapshot;
    }
  | {
      type: "self_death";
    };

export type ClientEntityEventHandler = (event: ClientEntityEvent) => void;

export type ClientMovementAction = "move_to_position" | "pursue_entity";

export type ClientMovementFailureReason =
  | "pathfinder_unavailable"
  | "goal_rejected"
  | "no_path"
  | "path_timeout"
  | "detour_too_long";

export interface ClientMovementFailedEvent {
  type: "movement_failed";
  movementId: string;
  action: ClientMovementAction;
  reason: ClientMovementFailureReason;
  detail: string;
}

export type ClientMovementEvent = ClientMovementFailedEvent;
export type ClientMovementEventHandler = (event: ClientMovementEvent) => void;

export interface ClientAdapter {
  readonly kind: ClientAdapterKind;

  setRuntimeState(state: RuntimeState): void;
  clearBotReference(): void;
  connect(context: ClientAdapterConnectContext): Promise<void>;
  awaitReady(timeoutMs?: number): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  waitForChatEcho(expectedSender: string, expectedMessage: string, timeoutMs: number): Promise<boolean>;
  subscribeChatEvents(handler: ClientChatEventHandler): () => void;
  subscribeEntityEvents(handler: ClientEntityEventHandler): () => void;
  subscribeMovementEvents(handler: ClientMovementEventHandler): () => void;
  getConnectionState(): ClientConnectionState;
  supportsCapability(capability: ClientCapability): boolean;
  sendChat(message: string): Promise<ActionResult>;
  getSelfState(): SelfStateSnapshot | null;
  getPlayerSnapshot(username: string): PlayerSnapshot | null;
  getNearbyPlayers(radius?: number): PlayerSnapshot[];
  getNearbyEntities(radius?: number): EntitySnapshot[];
  getBlockObservation(reach?: number): BlockObservationSnapshot;
  getInventoryState(includeSlots?: boolean): InventorySnapshot;
  attackEntity(input: AttackEntityInput): Promise<ActionResult>;
  attackNearestEntity(input?: AttackNearestEntityInput): Promise<ActionResult>;
  attackPlayer(input: AttackPlayerInput): Promise<ActionResult>;
  dropHeldItem(mode?: ClientAdapterDropMode): Promise<ActionResult>;
  dropHotbarSlot(input: DropHotbarSlotInput): Promise<ActionResult>;
  eatFood(input?: EatFoodInput): Promise<ActionResult>;
  holdHotbarSlot(input: HoldHotbarSlotInput): Promise<ActionResult>;
  holdItemByCategory(input: HoldItemByCategoryInput): Promise<ActionResult>;
  mineBlock(input: MineBlockInput): Promise<MineBlockResult>;
  organizeHotbar(): Promise<OrganizeHotbarResult>;
  moveTo(input: MoveToInput): Promise<ActionResult>;
  pursueEntity(input: PursueEntityInput): Promise<ActionResult>;
  look(yaw: number, pitch: number, force?: boolean): Promise<ActionResult>;
  openDoor(input?: OpenDoorInput): Promise<ActionResult>;
  swingArm(arm?: "right" | "left"): Promise<ActionResult>;
  useHeldItem(input?: UseItemInput): Promise<ActionResult>;
  walkForward(input?: WalkForwardInput): Promise<ActionResult>;
  stopMovement(): Promise<ActionResult>;

}
