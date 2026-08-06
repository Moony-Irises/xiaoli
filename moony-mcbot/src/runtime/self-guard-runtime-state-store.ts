import type { SelfGuardReactiveFlags } from "./self-guard-state.js";

export type { SelfGuardReactiveFlags } from "./self-guard-state.js";

export interface SelfGuardRuntimeState {
  lastAlertAt?: number;
  lastHealth?: number;
  lastIsDay?: boolean;
  lastIsRaining?: boolean;
  lastBotRef?: unknown;
  lastIsNearPlayer?: boolean;
  reactiveFlags?: SelfGuardReactiveFlags;
}

function validateTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError("Self-guard timestamp must be a non-negative finite number");
  }
}

function validateHealth(health: number): void {
  if (!Number.isFinite(health)) {
    throw new RangeError("Self-guard health must be a finite number");
  }
}

function cloneState(state: SelfGuardRuntimeState): SelfGuardRuntimeState {
  const cloned = { ...state };
  if (state.reactiveFlags) {
    cloned.reactiveFlags = { ...state.reactiveFlags };
  }
  return cloned;
}

function hasTickState(state: SelfGuardRuntimeState): boolean {
  return (
    state.lastHealth !== undefined ||
    state.lastIsDay !== undefined ||
    state.lastIsRaining !== undefined ||
    state.lastBotRef !== undefined ||
    state.lastIsNearPlayer !== undefined ||
    state.reactiveFlags !== undefined
  );
}

export class SelfGuardRuntimeStateStore {
  private readonly stateByBot = new Map<string, SelfGuardRuntimeState>();

  get(botId: string): SelfGuardRuntimeState | undefined {
    const state = this.stateByBot.get(botId);
    return state ? cloneState(state) : undefined;
  }

  update(botId: string, patch: SelfGuardRuntimeState): void {
    const changes: SelfGuardRuntimeState = {};
    let changed = false;

    if (patch.lastAlertAt !== undefined) {
      validateTimestamp(patch.lastAlertAt);
      changes.lastAlertAt = patch.lastAlertAt;
      changed = true;
    }
    if (patch.lastHealth !== undefined) {
      validateHealth(patch.lastHealth);
      changes.lastHealth = patch.lastHealth;
      changed = true;
    }
    if (patch.lastIsDay !== undefined) {
      changes.lastIsDay = patch.lastIsDay;
      changed = true;
    }
    if (patch.lastIsRaining !== undefined) {
      changes.lastIsRaining = patch.lastIsRaining;
      changed = true;
    }
    if (patch.lastBotRef !== undefined) {
      changes.lastBotRef = patch.lastBotRef;
      changed = true;
    }
    if (patch.lastIsNearPlayer !== undefined) {
      changes.lastIsNearPlayer = patch.lastIsNearPlayer;
      changed = true;
    }
    if (patch.reactiveFlags !== undefined) {
      changes.reactiveFlags = { ...patch.reactiveFlags };
      changed = true;
    }

    if (!changed) return;
    this.stateByBot.set(botId, {
      ...this.stateByBot.get(botId),
      ...changes
    });
  }

  resetTick(botId: string): boolean {
    const state = this.stateByBot.get(botId);
    if (!state || !hasTickState(state)) return false;

    if (state.lastAlertAt === undefined) {
      this.stateByBot.delete(botId);
    } else {
      this.stateByBot.set(botId, { lastAlertAt: state.lastAlertAt });
    }
    return true;
  }

  clearBot(botId: string): boolean {
    return this.stateByBot.delete(botId);
  }
}
