export interface TerritoryPresenceState {
  enteredAt: number;
  warnedAt: number;
  escalatedAt?: number;
}

function cloneState(state: TerritoryPresenceState): TerritoryPresenceState {
  return { ...state };
}

export class TerritoryPresenceStore {
  private readonly stateByBot = new Map<string, Map<string, TerritoryPresenceState>>();

  get(botId: string, presenceKey: string): TerritoryPresenceState | undefined {
    const state = this.stateByBot.get(botId)?.get(presenceKey);
    return state ? cloneState(state) : undefined;
  }

  set(botId: string, presenceKey: string, state: TerritoryPresenceState): void {
    let stateByKey = this.stateByBot.get(botId);
    if (!stateByKey) {
      stateByKey = new Map<string, TerritoryPresenceState>();
      this.stateByBot.set(botId, stateByKey);
    }
    stateByKey.set(presenceKey, cloneState(state));
  }

  delete(botId: string, presenceKey: string): boolean {
    const stateByKey = this.stateByBot.get(botId);
    if (!stateByKey) return false;

    const deleted = stateByKey.delete(presenceKey);
    if (stateByKey.size === 0) this.stateByBot.delete(botId);
    return deleted;
  }

  prune(botId: string, activeKeys: ReadonlySet<string>): number {
    const stateByKey = this.stateByBot.get(botId);
    if (!stateByKey) return 0;

    let removedCount = 0;
    for (const presenceKey of stateByKey.keys()) {
      if (activeKeys.has(presenceKey)) continue;
      stateByKey.delete(presenceKey);
      removedCount += 1;
    }

    if (stateByKey.size === 0) this.stateByBot.delete(botId);
    return removedCount;
  }

  clearBot(botId: string): boolean {
    return this.stateByBot.delete(botId);
  }
}
