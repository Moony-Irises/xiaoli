export interface RetaliationSessionState {
  attackerName: string;
  remainingHits: number;
  lastAttackAt: number;
  startedAt: number;
}

interface RetaliationHitState {
  count: number;
  lastHitAt: number;
}

function validateAttackerName(attackerName: string): void {
  if (attackerName.trim().length === 0) {
    throw new TypeError("Retaliation attacker name must not be blank");
  }
}

function validateTimestamp(timestamp: number): void {
  if (!Number.isFinite(timestamp) || timestamp < 0) {
    throw new RangeError("Retaliation timestamp must be a non-negative finite number");
  }
}

function validateDecayMs(decayMs: number): void {
  if (!Number.isFinite(decayMs) || decayMs <= 0) {
    throw new RangeError("Retaliation decay must be a positive finite number");
  }
}

export class RetaliationStateStore {
  private readonly sessions = new Map<string, RetaliationSessionState>();
  private readonly hitsByBot = new Map<string, Map<string, RetaliationHitState>>();

  getSession(botId: string): RetaliationSessionState | undefined {
    return this.sessions.get(botId);
  }

  setSession(botId: string, session: RetaliationSessionState): void {
    this.sessions.set(botId, session);
  }

  deleteSession(botId: string): boolean {
    return this.sessions.delete(botId);
  }

  recordHit(botId: string, attackerName: string, now: number, decayMs: number): number {
    validateAttackerName(attackerName);
    validateTimestamp(now);
    validateDecayMs(decayMs);
    this.pruneExpiredHits(botId, now, decayMs);

    let hitsByAttacker = this.hitsByBot.get(botId);
    if (!hitsByAttacker) {
      hitsByAttacker = new Map<string, RetaliationHitState>();
      this.hitsByBot.set(botId, hitsByAttacker);
    }

    const nextCount = (hitsByAttacker.get(attackerName)?.count ?? 0) + 1;
    hitsByAttacker.set(attackerName, { count: nextCount, lastHitAt: now });
    return nextCount;
  }

  pruneExpiredHits(botId: string, now: number, decayMs: number): number {
    validateTimestamp(now);
    validateDecayMs(decayMs);

    const hitsByAttacker = this.hitsByBot.get(botId);
    if (!hitsByAttacker) return 0;

    let removedCount = 0;
    for (const [attackerName, hitState] of hitsByAttacker.entries()) {
      if (now - hitState.lastHitAt < decayMs) continue;
      hitsByAttacker.delete(attackerName);
      removedCount += 1;
    }

    if (hitsByAttacker.size === 0) {
      this.hitsByBot.delete(botId);
    }
    return removedCount;
  }

  clearBot(botId: string): boolean {
    const sessionDeleted = this.sessions.delete(botId);
    const hitsDeleted = this.hitsByBot.delete(botId);
    return sessionDeleted || hitsDeleted;
  }
}
