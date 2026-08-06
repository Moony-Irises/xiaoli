import mineflayer from "mineflayer";
import { log } from "../logger.js";
import { AuthService } from "../services/auth-service.js";
import { McClientService } from "../services/mc-client-service.js";
import { BotConfig, BotCreateInput, RuntimeErrorCode, RuntimeState, RuntimeStatus } from "../types.js";
import { classifyRuntimeError } from "../utils/errors.js";
import { ActionResult, AttackEntityInput, AttackNearestEntityInput, AttackPlayerInput, BlockObservationSnapshot, CLIENT_CAPABILITIES, ClientAdapter, ClientAdapterActionRecord, ClientAdapterDropMode, ClientAdapterKind, ClientAdapterStatus, ClientCapability, ClientChatEventHandler, ClientEntityEventHandler, ClientMovementEventHandler, DropHotbarSlotInput, EatFoodInput, EntitySnapshot, HoldHotbarSlotInput, HoldItemByCategoryInput, InventorySnapshot, MineBlockInput, MineBlockResult, MoveToInput, OpenDoorInput, OrganizeHotbarResult, PlayerSnapshot, PursueEntityInput, SelfStateSnapshot, UseItemInput, WalkForwardInput } from "./client-adapter.js";
import {
  ClientAdapterFactory,
  createDefaultClientAdapterFactory
} from "./client-adapter-factory.js";

const DEFAULT_VERSION = "1.20.1";
const DEFAULT_PORT = 25565;
const DEFAULT_CONNECT_MAX_RETRIES = 2;
const DEFAULT_AUTO_RECONNECT_ATTEMPTS = 8;
const DEFAULT_RECONNECT_BASE_DELAY_MS = 1000;
const DEFAULT_RECONNECT_MAX_DELAY_MS = 30000;
const MAX_ADAPTER_ACTION_HISTORY = 24;
const DEFAULT_CLIENT_ADAPTER_KIND: ClientAdapterKind = "mineflayer";

interface MineflayerCompatibilityAdapter {
  getNativeMineflayerBot(): mineflayer.Bot | null;
  getNativeMineflayerBotOrThrow(): mineflayer.Bot;
}

export interface BotRuntimeDependencies {
  clientAdapterKind?: ClientAdapterKind;
  clientAdapterFactory?: ClientAdapterFactory;
}

export class BotRuntime {
  private readonly config: BotConfig;
  private readonly authService: AuthService;
  private readonly mcClientService: McClientService;
  private readonly adapter: ClientAdapter;
  private readonly autoReconnect: boolean;
  private readonly maxAutoReconnectAttempts: number;
  private readonly reconnectBaseDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly connectMaxRetries: number;
  private readonly adapterActionHistory: ClientAdapterActionRecord[] = [];
  private readonly movementEventHandlers = new Set<ClientMovementEventHandler>();
  private movementAdapterUnsubscribe: (() => void) | null = null;

  private state: RuntimeState = "idle";
  private connectedAt: Date | undefined;
  private profileName: string | undefined;
  private profileId: string | undefined;
  private lastError: string | undefined;
  private lastErrorCode: RuntimeErrorCode | undefined;
  private lastKickReason: string | undefined;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private reconnectInProgress = false;
  private manualDisconnect = false;
  private connectionGeneration = 0;
  private clientLifecycleUnsubscribe: (() => void) | null = null;
  private disconnectPromise: Promise<RuntimeStatus> | null = null;

  constructor(
    private readonly botId: string,
    input: BotCreateInput,
    dependencies: BotRuntimeDependencies = {}
  ) {
    this.config = {
      authApiBaseUrl: input.authApiBaseUrl,
      username: input.username,
      password: input.password,
      serverHost: input.serverHost,
      serverPort: input.serverPort ?? DEFAULT_PORT,
      useSrv: input.useSrv ?? true,
      version: input.version ?? DEFAULT_VERSION
    };

    this.autoReconnect = input.autoReconnect ?? true;
    this.maxAutoReconnectAttempts = input.maxAutoReconnectAttempts ?? DEFAULT_AUTO_RECONNECT_ATTEMPTS;
    this.reconnectBaseDelayMs = input.reconnectBaseDelayMs ?? DEFAULT_RECONNECT_BASE_DELAY_MS;
    this.reconnectMaxDelayMs = input.reconnectMaxDelayMs ?? DEFAULT_RECONNECT_MAX_DELAY_MS;
    this.connectMaxRetries = input.connectMaxRetries ?? DEFAULT_CONNECT_MAX_RETRIES;

    this.authService = new AuthService();
    this.mcClientService = new McClientService();
    const clientAdapterKind = dependencies.clientAdapterKind ?? DEFAULT_CLIENT_ADAPTER_KIND;
    const clientAdapterFactory = dependencies.clientAdapterFactory ?? createDefaultClientAdapterFactory({
      mcClientService: this.mcClientService
    });
    const adapter = clientAdapterFactory.create(clientAdapterKind);
    if (adapter.kind !== clientAdapterKind) {
      throw new Error(
        `Client adapter factory requested '${clientAdapterKind}' but returned '${adapter.kind}'`
      );
    }
    this.adapter = adapter;
  }

  getStatus(): RuntimeStatus {
    return {
      botId: this.botId,
      state: this.state,
      clientAdapterKind: this.adapter.kind,
      profileName: this.profileName,
      profileId: this.profileId,
      serverHost: this.config.serverHost,
      serverPort: this.config.serverPort,
      useSrv: this.config.useSrv,
      version: this.config.version,
      connectedAt: this.connectedAt?.toISOString(),
      lastError: this.lastError,
      lastErrorCode: this.lastErrorCode,
      lastKickReason: this.lastKickReason,
      autoReconnect: this.autoReconnect,
      reconnectInProgress: this.reconnectInProgress,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  getActiveBotOrThrow(): mineflayer.Bot {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.getNativeMineflayerBotOrThrow();
  }

  private getNativeMineflayerBot(): mineflayer.Bot | null {
    if (this.adapter.kind !== "mineflayer") return null;
    return (this.adapter as ClientAdapter & MineflayerCompatibilityAdapter).getNativeMineflayerBot();
  }

  private getNativeMineflayerBotOrThrow(): mineflayer.Bot {
    if (this.adapter.kind !== "mineflayer") {
      throw new Error(`Bot '${this.botId}' adapter '${this.adapter.kind}' has no Mineflayer bot handle`);
    }
    return (this.adapter as ClientAdapter & MineflayerCompatibilityAdapter).getNativeMineflayerBotOrThrow();
  }

  getClientAdapterKind(): ClientAdapterKind {
    return this.adapter.kind;
  }

  supportsClientCapability(capability: ClientCapability): boolean {
    return this.adapter.supportsCapability(capability);
  }

  getClientAdapterStatus(): ClientAdapterStatus {
    const capabilities = Object.fromEntries(
      CLIENT_CAPABILITIES.map((capability) => [capability, this.adapter.supportsCapability(capability)])
    ) as Record<ClientCapability, boolean>;
    return {
      kind: this.adapter.kind,
      connection: this.adapter.getConnectionState(),
      capabilities,
      recentActions: [...this.adapterActionHistory]
    };
  }

  private async runAdapterAction<T extends ActionResult>(action: string, execute: () => Promise<T>): Promise<T> {
    try {
      const result = await execute();
      this.recordAdapterAction({
        action,
        ok: result.ok,
        detail: action === "send_chat" && result.ok ? "chat sent" : result.detail
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.recordAdapterAction({ action, ok: false, error: message });
      throw error;
    }
  }

  private recordAdapterAction(entry: Omit<ClientAdapterActionRecord, "timestamp">): void {
    this.adapterActionHistory.unshift({ ...entry, timestamp: new Date().toISOString() });
    if (this.adapterActionHistory.length > MAX_ADAPTER_ACTION_HISTORY) {
      this.adapterActionHistory.length = MAX_ADAPTER_ACTION_HISTORY;
    }
  }

  private ensureMovementEventBridge(): void {
    if (this.movementAdapterUnsubscribe) return;
    this.movementAdapterUnsubscribe = this.adapter.subscribeMovementEvents((event) => {
      this.recordAdapterAction({
        action: event.action,
        ok: false,
        error: event.detail
      });
      for (const handler of [...this.movementEventHandlers]) {
        try {
          handler(event);
        } catch {
          // One observer must not prevent evidence recording or other observers.
        }
      }
    });
  }

  private detachMovementEventBridge(): void {
    this.movementAdapterUnsubscribe?.();
    this.movementAdapterUnsubscribe = null;
  }

  private clearMovementEventBridge(): void {
    this.detachMovementEventBridge();
    this.movementEventHandlers.clear();
  }

  async sendChat(message: string): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("send_chat", () => this.adapter.sendChat(message));
  }

  async waitForChatEcho(expectedSender: string, expectedMessage: string, timeoutMs: number): Promise<boolean> {
    if (this.state !== "spawned") return false;
    return this.adapter.waitForChatEcho(expectedSender, expectedMessage, timeoutMs);
  }

  subscribeChatEvents(handler: ClientChatEventHandler): () => void {
    if (this.state !== "spawned") return () => {};
    return this.adapter.subscribeChatEvents(handler);
  }

  subscribeEntityEvents(handler: ClientEntityEventHandler): () => void {
    if (this.state !== "spawned") return () => {};
    return this.adapter.subscribeEntityEvents(handler);
  }

  subscribeMovementEvents(handler: ClientMovementEventHandler): () => void {
    if (this.state !== "spawned") return () => {};
    this.movementEventHandlers.add(handler);
    this.ensureMovementEventBridge();

    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.movementEventHandlers.delete(handler);
    };
  }

  getSelfState(): SelfStateSnapshot | null {
    if (this.state !== "spawned") {
      return null;
    }
    return this.adapter.getSelfState();
  }

  getPlayerSnapshot(username: string): PlayerSnapshot | null {
    if (this.state !== "spawned") {
      return null;
    }
    return this.adapter.getPlayerSnapshot(username);
  }

  getNearbyPlayers(radius = 32): PlayerSnapshot[] {
    if (this.state !== "spawned") {
      return [];
    }
    return this.adapter.getNearbyPlayers(radius);
  }

  getNearbyEntities(radius = 24): EntitySnapshot[] {
    if (this.state !== "spawned") {
      return [];
    }
    return this.adapter.getNearbyEntities(radius);
  }

  getBlockObservation(reach = 4): BlockObservationSnapshot {
    if (this.state !== "spawned") {
      return {
        feet: null,
        inSight: null
      };
    }
    return this.adapter.getBlockObservation(reach);
  }

  getInventoryState(includeSlots = false): InventorySnapshot {
    if (this.state !== "spawned") {
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
    return this.adapter.getInventoryState(includeSlots);
  }

  async look(yaw: number, pitch: number, force = true): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("look", () => this.adapter.look(yaw, pitch, force));
  }

  async walkForward(input: WalkForwardInput = {}): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("walk_forward", () => this.adapter.walkForward(input));
  }

  async attackPlayer(input: AttackPlayerInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("attack_player", () => this.adapter.attackPlayer(input));
  }

  async attackEntity(input: AttackEntityInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("attack_entity", () => this.adapter.attackEntity(input));
  }

  async attackNearestEntity(input: AttackNearestEntityInput = {}): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("attack_nearest_entity", () => this.adapter.attackNearestEntity(input));
  }

  async pursueEntity(input: PursueEntityInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    this.ensureMovementEventBridge();
    return this.runAdapterAction("pursue_entity", () => this.adapter.pursueEntity(input));
  }

  async moveTo(input: MoveToInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    this.ensureMovementEventBridge();
    return this.runAdapterAction("move_to_position", () => this.adapter.moveTo(input));
  }

  async mineBlock(input: MineBlockInput): Promise<MineBlockResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("mine_block", () => this.adapter.mineBlock(input));
  }

  async swingArm(arm: "right" | "left" = "right"): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("swing_arm", () => this.adapter.swingArm(arm));
  }

  async dropHeldItem(mode: ClientAdapterDropMode = "one"): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("drop_held_item", () => this.adapter.dropHeldItem(mode));
  }

  async dropHotbarSlot(input: DropHotbarSlotInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("drop_hotbar_slot", () => this.adapter.dropHotbarSlot(input));
  }

  async holdHotbarSlot(input: HoldHotbarSlotInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("hold_hotbar_slot", () => this.adapter.holdHotbarSlot(input));
  }

  async holdItemByCategory(input: HoldItemByCategoryInput): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("hold_item_by_category", () => this.adapter.holdItemByCategory(input));
  }

  async organizeHotbar(): Promise<OrganizeHotbarResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("organize_hotbar", () => this.adapter.organizeHotbar());
  }

  async eatFood(input: EatFoodInput = {}): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("eat_food", () => this.adapter.eatFood(input));
  }

  async useHeldItem(input: UseItemInput = {}): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("use_held_item", () => this.adapter.useHeldItem(input));
  }

  async openDoor(input: OpenDoorInput = {}): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("open_door", () => this.adapter.openDoor(input));
  }

  async stopMovement(): Promise<ActionResult> {
    if (this.state !== "spawned") {
      throw new Error(`Bot '${this.botId}' is not connected (state=${this.state})`);
    }
    return this.runAdapterAction("stop_movement", () => this.adapter.stopMovement());
  }

  async connect(options?: { maxRetries?: number }): Promise<RuntimeStatus> {
    if (this.disconnectPromise) {
      throw new Error("Bot disconnect is in progress");
    }

    if (this.state === "connecting" || this.state === "authenticating") {
      throw new Error("Bot is already connecting");
    }

    if (this.state === "spawned" && this.getNativeMineflayerBot()) {
      return this.getStatus();
    }

    this.manualDisconnect = false;
    this.clearReconnectTimer();
    this.reconnectInProgress = false;
    const generation = ++this.connectionGeneration;

    const maxRetries = options?.maxRetries ?? this.connectMaxRetries;
    return this.connectWithRetry(maxRetries, generation);
  }

  disconnect(reason = "Disconnected by user request"): Promise<RuntimeStatus> {
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

  private async disconnectOnce(reason: string): Promise<RuntimeStatus> {
    this.connectionGeneration += 1;
    this.manualDisconnect = true;
    this.reconnectInProgress = false;
    this.clearReconnectTimer();
    this.clearMovementEventBridge();
    this.clearClientLifecycleListeners();
    this.adapter.setRuntimeState("disconnected");
    this.state = "disconnected";

    try {
      await this.adapter.disconnect(reason);
      return this.getStatus();
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      const classified = classifyRuntimeError(normalized);
      this.lastError = classified.message;
      this.lastErrorCode = classified.code;
      throw normalized;
    } finally {
      this.clearMovementEventBridge();
      this.clearClientLifecycleListeners();
      this.adapter.setRuntimeState("disconnected");
      this.state = "disconnected";
    }
  }

  private async connectWithRetry(maxRetries: number, generation: number): Promise<RuntimeStatus> {
    this.lastError = undefined;
    this.lastErrorCode = undefined;
    this.lastKickReason = undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.assertConnectionCurrent(generation);
        const status = await this.connectOnce(generation);
        this.assertConnectionCurrent(generation);
        this.reconnectAttempts = 0;
        this.reconnectInProgress = false;
        return status;
      } catch (error) {
        if (!this.isConnectionCurrent(generation)) {
          throw new Error("Connect attempt cancelled");
        }

        const classified = classifyRuntimeError(error);
        this.lastError = classified.message;
        this.lastErrorCode = classified.code;
        this.state = "error";

        const canRetry = classified.retryable && attempt < maxRetries;
        if (!canRetry) {
          throw new Error(`[${classified.code}] ${classified.message}`);
        }

        const delayMs = this.getBackoffDelayMs(attempt);
        log("warn", "Connect attempt failed, retrying", {
          botId: this.botId,
          attempt: attempt + 1,
          maxRetries,
          delayMs,
          errorCode: classified.code,
          error: classified.message
        });
        await this.sleep(delayMs);
      }
    }

    throw new Error("Unexpected connect retry loop exit");
  }

  private async connectOnce(generation: number): Promise<RuntimeStatus> {
    try {
      this.assertConnectionCurrent(generation);
      this.state = "authenticating";
      const session = await this.authService.authenticate(
        this.config.authApiBaseUrl,
        this.config.username,
        this.config.password,
        this.botId
      );
      this.assertConnectionCurrent(generation);

      this.state = "authenticated";
      this.adapter.setRuntimeState("authenticated");
      this.profileName = session.selectedProfile.name;
      this.profileId = session.selectedProfile.id;

      this.state = "connecting";
      this.adapter.setRuntimeState("connecting");
      await this.adapter.connect({
        config: this.config,
        session
      });
      this.assertConnectionCurrent(generation);
      const bot = this.getNativeMineflayerBotOrThrow();
      this.attachLifecycleListeners(bot, generation);

      await this.adapter.awaitReady();
      this.assertConnectionCurrent(generation);
      this.state = "spawned";
      this.adapter.setRuntimeState("spawned");
      this.connectedAt = new Date();

      log("info", "Bot spawned", {
        botId: this.botId,
        serverHost: this.config.serverHost,
        serverPort: this.config.serverPort,
        version: this.config.version
      });

      return this.getStatus();
    } catch (error) {
      if (this.isConnectionCurrent(generation)) {
        this.clearClientLifecycleListeners();
        this.clearMovementEventBridge();
        try {
          await this.adapter.disconnect("Connect attempt failed");
        } catch (cleanupError) {
          log("warn", "Client adapter cleanup failed after connect error", {
            botId: this.botId,
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
          });
        } finally {
          this.adapter.setRuntimeState("error");
        }
      }

      throw error;
    }
  }

  private attachLifecycleListeners(bot: mineflayer.Bot, generation: number): void {
    this.clearClientLifecycleListeners();

    const onLogin = (): void => {
      if (!this.isConnectionCurrent(generation)) return;
      log("info", "Bot logged in", {
        botId: this.botId,
        username: bot.username
      });
    };

    const onKicked = (reason: unknown): void => {
      if (!this.isConnectionCurrent(generation)) return;
      this.clearClientLifecycleListeners();
      this.lastKickReason = this.mcClientService.formatReason(reason);
      this.state = "disconnected";
      this.clearMovementEventBridge();
      this.adapter.setRuntimeState("disconnected");
      this.adapter.clearBotReference();
      this.lastErrorCode = "SERVER_KICKED";
      this.lastError = this.lastKickReason;

      log("warn", "Bot kicked", {
        botId: this.botId,
        reason: this.lastKickReason
      });

      this.scheduleAutoReconnect("kicked");
    };

    const onError = (error: Error): void => {
      if (!this.isConnectionCurrent(generation)) return;
      const classified = classifyRuntimeError(error);
      this.lastError = classified.message;
      this.lastErrorCode = classified.code;

      log("error", "Bot error event", {
        botId: this.botId,
        errorCode: classified.code,
        error: classified.message
      });
    };

    const onEnd = (reason: string): void => {
      if (!this.isConnectionCurrent(generation)) return;
      this.clearClientLifecycleListeners();
      const text = this.mcClientService.formatReason(reason);
      if (!this.lastError && text) {
        this.lastError = text;
      }
      if (!this.lastErrorCode && text) {
        this.lastErrorCode = "HANDSHAKE_FAILED";
      }

      this.clearMovementEventBridge();
      this.state = "disconnected";
      this.adapter.setRuntimeState("disconnected");
      this.adapter.clearBotReference();

      log("info", "Bot disconnected", {
        botId: this.botId,
        reason: text
      });

      this.scheduleAutoReconnect("end");
    };

    const unsubscribe = (): void => {
      bot.off("login", onLogin);
      bot.off("kicked", onKicked);
      bot.off("error", onError);
      bot.off("end", onEnd);
      if (this.clientLifecycleUnsubscribe === unsubscribe) {
        this.clientLifecycleUnsubscribe = null;
      }
    };

    bot.on("login", onLogin);
    bot.on("kicked", onKicked);
    bot.on("error", onError);
    bot.on("end", onEnd);
    this.clientLifecycleUnsubscribe = unsubscribe;
  }

  private clearClientLifecycleListeners(): void {
    const unsubscribe = this.clientLifecycleUnsubscribe;
    this.clientLifecycleUnsubscribe = null;
    unsubscribe?.();
  }

  private scheduleAutoReconnect(trigger: string): void {
    if (!this.autoReconnect || this.manualDisconnect) {
      return;
    }

    if (this.reconnectInProgress || this.reconnectTimer) {
      return;
    }

    if (this.reconnectAttempts >= this.maxAutoReconnectAttempts) {
      log("error", "Auto reconnect stopped after max attempts", {
        botId: this.botId,
        maxAutoReconnectAttempts: this.maxAutoReconnectAttempts,
        trigger
      });
      return;
    }

    const delayMs = this.getBackoffDelayMs(this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectInProgress = true;
    const scheduledGeneration = this.connectionGeneration;

    log("info", "Scheduling auto reconnect", {
      botId: this.botId,
      trigger,
      attempt: this.reconnectAttempts,
      delayMs
    });

    this.reconnectTimer = setTimeout(async () => {
      this.clearReconnectTimer();
      if (!this.isConnectionCurrent(scheduledGeneration)) {
        return;
      }

      const generation = ++this.connectionGeneration;
      try {
        await this.connectWithRetry(this.connectMaxRetries, generation);
      } catch (error) {
        if (!this.isConnectionCurrent(generation)) {
          return;
        }
        const classified = classifyRuntimeError(error);
        this.lastError = classified.message;
        this.lastErrorCode = classified.code;
        log("error", "Auto reconnect attempt failed", {
          botId: this.botId,
          attempt: this.reconnectAttempts,
          errorCode: classified.code,
          error: classified.message
        });
        this.reconnectInProgress = false;
        this.scheduleAutoReconnect("reconnect-failure");
      }
    }, delayMs);
  }

  private getBackoffDelayMs(attempt: number): number {
    const exponential = this.reconnectBaseDelayMs * 2 ** attempt;
    return Math.min(exponential, this.reconnectMaxDelayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private isConnectionCurrent(generation: number): boolean {
    return generation === this.connectionGeneration && !this.manualDisconnect;
  }

  private assertConnectionCurrent(generation: number): void {
    if (!this.isConnectionCurrent(generation)) {
      throw new Error("Connect attempt cancelled");
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
