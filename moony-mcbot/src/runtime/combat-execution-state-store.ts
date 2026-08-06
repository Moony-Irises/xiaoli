interface CombatExecutionState {
  hitCount?: number;
  lastEquipAt?: number;
}

function validateTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError("Combat equip timestamp must be a non-negative finite number");
  }
}

export class CombatExecutionStateStore {
  private readonly stateByBot = new Map<string, CombatExecutionState>();

  getLastEquipAt(botId: string): number | undefined {
    return this.stateByBot.get(botId)?.lastEquipAt;
  }

  recordEquip(botId: string, timestamp: number): void {
    validateTimestamp(timestamp);
    this.stateByBot.set(botId, {
      ...this.stateByBot.get(botId),
      lastEquipAt: timestamp
    });
  }

  nextHitIndex(botId: string): number {
    const state = this.stateByBot.get(botId);
    const next = (state?.hitCount ?? 0) + 1;
    this.stateByBot.set(botId, {
      ...state,
      hitCount: next
    });
    return next;
  }

  clearBot(botId: string): boolean {
    return this.stateByBot.delete(botId);
  }
}
