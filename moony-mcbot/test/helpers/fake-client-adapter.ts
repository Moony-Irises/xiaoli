import { RuntimeState } from "../../src/types.js";
import {
  ActionResult,
  AttackEntityInput,
  AttackNearestEntityInput,
  AttackPlayerInput,
  BlockObservationSnapshot,
  ClientAdapter,
  ClientAdapterConnectContext,
  ClientAdapterDropMode,
  ClientAdapterKind,
  ClientCapability,
  ClientChatEventHandler,
  ClientConnectionState,
  ClientEntityEventHandler,
  ClientMovementEventHandler,
  DropHotbarSlotInput,
  EatFoodInput,
  HoldHotbarSlotInput,
  HoldItemByCategoryInput,
  InventorySnapshot,
  MineBlockInput,
  MineBlockResult,
  MoveToInput,
  OpenDoorInput,
  OrganizeHotbarResult,
  PursueEntityInput,
  SelfStateSnapshot,
  UseItemInput,
  WalkForwardInput
} from "../../src/runtime/client-adapter.js";

export class FakeClientAdapter implements ClientAdapter {
  private runtimeState: RuntimeState = "idle";

  constructor(readonly kind: ClientAdapterKind) {}

  setRuntimeState(state: RuntimeState): void {
    this.runtimeState = state;
  }

  clearBotReference(): void {}

  async connect(_context: ClientAdapterConnectContext): Promise<void> {
    this.runtimeState = "connecting";
  }

  async awaitReady(_timeoutMs?: number): Promise<void> {
    this.runtimeState = "spawned";
  }

  async disconnect(_reason?: string): Promise<void> {
    this.runtimeState = "disconnected";
  }

  async waitForChatEcho(
    _expectedSender: string,
    _expectedMessage: string,
    _timeoutMs: number
  ): Promise<boolean> {
    return false;
  }

  subscribeChatEvents(_handler: ClientChatEventHandler): () => void {
    return () => {};
  }

  subscribeEntityEvents(_handler: ClientEntityEventHandler): () => void {
    return () => {};
  }

  subscribeMovementEvents(_handler: ClientMovementEventHandler): () => void {
    return () => {};
  }

  getConnectionState(): ClientConnectionState {
    return {
      kind: this.kind,
      runtimeState: this.runtimeState,
      connected: this.runtimeState === "spawned"
    };
  }

  supportsCapability(_capability: ClientCapability): boolean {
    return false;
  }

  async sendChat(_message: string): Promise<ActionResult> {
    return this.unsupported("send_chat");
  }

  getSelfState(): SelfStateSnapshot | null {
    return null;
  }

  getPlayerSnapshot(_username: string): null {
    return null;
  }

  getNearbyPlayers(_radius?: number): [] {
    return [];
  }

  getNearbyEntities(_radius?: number): [] {
    return [];
  }

  getBlockObservation(_reach?: number): BlockObservationSnapshot {
    return { feet: null, inSight: null };
  }

  getInventoryState(includeSlots = false): InventorySnapshot {
    return {
      heldItem: null,
      armor: { head: null, torso: null, legs: null, feet: null },
      items: [],
      slots: includeSlots ? [] : undefined
    };
  }

  async attackEntity(_input: AttackEntityInput): Promise<ActionResult> {
    return this.unsupported("attack_entity");
  }

  async attackNearestEntity(_input?: AttackNearestEntityInput): Promise<ActionResult> {
    return this.unsupported("attack_nearest_entity");
  }

  async attackPlayer(_input: AttackPlayerInput): Promise<ActionResult> {
    return this.unsupported("attack_player");
  }

  async dropHeldItem(_mode?: ClientAdapterDropMode): Promise<ActionResult> {
    return this.unsupported("drop_held_item");
  }

  async dropHotbarSlot(_input: DropHotbarSlotInput): Promise<ActionResult> {
    return this.unsupported("drop_hotbar_slot");
  }

  async eatFood(_input?: EatFoodInput): Promise<ActionResult> {
    return this.unsupported("eat_food");
  }

  async holdHotbarSlot(_input: HoldHotbarSlotInput): Promise<ActionResult> {
    return this.unsupported("hold_hotbar_slot");
  }

  async holdItemByCategory(_input: HoldItemByCategoryInput): Promise<ActionResult> {
    return this.unsupported("hold_item_by_category");
  }

  async mineBlock(_input: MineBlockInput): Promise<MineBlockResult> {
    return this.unsupported("mine_block");
  }

  async organizeHotbar(): Promise<OrganizeHotbarResult> {
    return this.unsupported("organize_hotbar");
  }

  async moveTo(_input: MoveToInput): Promise<ActionResult> {
    return this.unsupported("move_to_position");
  }

  async pursueEntity(_input: PursueEntityInput): Promise<ActionResult> {
    return this.unsupported("pursue_entity");
  }

  async look(_yaw: number, _pitch: number, _force?: boolean): Promise<ActionResult> {
    return this.unsupported("look");
  }

  async openDoor(_input?: OpenDoorInput): Promise<ActionResult> {
    return this.unsupported("open_door");
  }

  async swingArm(_arm?: "right" | "left"): Promise<ActionResult> {
    return this.unsupported("swing_arm");
  }

  async useHeldItem(_input?: UseItemInput): Promise<ActionResult> {
    return this.unsupported("use_held_item");
  }

  async walkForward(_input?: WalkForwardInput): Promise<ActionResult> {
    return this.unsupported("walk_forward");
  }

  async stopMovement(): Promise<ActionResult> {
    return this.unsupported("stop_movement");
  }

  private unsupported(action: string): never {
    throw new Error(`Fake adapter action '${action}' is not configured`);
  }
}
