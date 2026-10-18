import type { TerritoryPresenceState } from "./territory-presence-store.js";

export interface TerritoryWarningInput {
  now: number;
  warningCooldownMs: number;
  escalationEnabled: boolean;
  escalationDelayMs: number;
  ownerNearby: boolean;
  existing?: Readonly<TerritoryPresenceState>;
}

export type TerritoryWarningDecision =
  | { action: "warn"; nextState: TerritoryPresenceState }
  | { action: "hold_escalation" }
  | { action: "escalate"; nextState: TerritoryPresenceState }
  | { action: "none" };

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function hasValidTimeState(input: TerritoryWarningInput): boolean {
  if (
    !isNonNegativeFinite(input.now) ||
    !isNonNegativeFinite(input.warningCooldownMs) ||
    !isNonNegativeFinite(input.escalationDelayMs)
  ) {
    return false;
  }

  const existing = input.existing;
  return !existing || (
    isNonNegativeFinite(existing.enteredAt) &&
    isNonNegativeFinite(existing.warnedAt) &&
    (existing.escalatedAt === undefined || isNonNegativeFinite(existing.escalatedAt))
  );
}

export function evaluateTerritoryWarning(
  input: TerritoryWarningInput
): TerritoryWarningDecision {
  if (!hasValidTimeState(input)) return { action: "none" };

  const existing = input.existing;
  if (!existing || input.now - existing.warnedAt >= input.warningCooldownMs) {
    return {
      action: "warn",
      nextState: {
        enteredAt: existing?.enteredAt ?? input.now,
        warnedAt: input.now
      }
    };
  }

  if (
    input.escalationEnabled &&
    !existing.escalatedAt &&
    input.now - existing.enteredAt >= input.escalationDelayMs
  ) {
    if (!input.ownerNearby) return { action: "hold_escalation" };
    return {
      action: "escalate",
      nextState: {
        ...existing,
        escalatedAt: input.now
      }
    };
  }

  return { action: "none" };
}
