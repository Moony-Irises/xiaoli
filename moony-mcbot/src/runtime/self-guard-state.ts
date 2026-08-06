import type {
  InventorySnapshot,
  PlayerSnapshot,
  SelfStateSnapshot
} from "./client-adapter.js";

export interface SelfGuardVitalsThresholds {
  lowHealth: number;
  criticalHealth: number;
  lowFood: number;
  autoEat: boolean;
}

export interface SelfGuardReactiveFlags {
  lowHealth: boolean;
  criticalHealth: boolean;
  lowFood: boolean;
}

export interface SelfGuardAlertCooldownInput {
  chatAlertsEnabled: boolean;
  now: number;
  lastAlertAt?: number;
  cooldownMs: number;
}

export type SelfGuardAlertCooldownDecision =
  | { allowed: false; reason: "disabled" | "invalid_input" | "cooldown" }
  | { allowed: true; nextLastAlertAt: number };

export type SelfGuardVitalsDecision =
  | { available: false }
  | {
      available: true;
      health: number;
      food: number;
      lowHealth: boolean;
      criticalHealth: boolean;
      lowFood: boolean;
      shouldEatForFood: boolean;
      shouldEatForHealing: boolean;
      shouldEatNow: boolean;
      shouldSetCalm: boolean;
    };

export interface SelfGuardProximityDecision {
  isNear: boolean;
  enteredNearRange: boolean;
}

export interface SelfGuardCoreTransitionInput {
  currentBotRef: unknown;
  previousBotRef?: unknown;
  previousHealth?: number;
  vitals: SelfGuardVitalsDecision;
}

export interface SelfGuardCoreTransitions {
  reconnected: boolean;
  healthDropped: boolean;
}

type SelfGuardReactiveSignalPayload = {
  health: number;
  food: number;
  hasFood: boolean;
};

export type SelfGuardReactiveSignal =
  | {
      type: "low_health";
      priority: "critical";
      payload: SelfGuardReactiveSignalPayload & {
        severity: "critical";
        reason: "critical_health_threshold";
      };
    }
  | {
      type: "low_health";
      priority: "high";
      payload: SelfGuardReactiveSignalPayload & {
        severity: "warning";
        reason: "low_health_threshold";
      };
    }
  | {
      type: "low_food";
      priority: "high";
      payload: SelfGuardReactiveSignalPayload & {
        severity: "warning";
        reason: "low_food_threshold";
      };
    };

export type SelfGuardReactiveDecision =
  | { available: false }
  | {
      available: true;
      nextFlags: SelfGuardReactiveFlags;
      signals: readonly SelfGuardReactiveSignal[];
    };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

export function evaluateSelfGuardAlertCooldown(
  input: Readonly<SelfGuardAlertCooldownInput>
): SelfGuardAlertCooldownDecision {
  if (!input.chatAlertsEnabled) {
    return { allowed: false, reason: "disabled" };
  }

  const lastAlertAt = input.lastAlertAt ?? 0;
  if (
    !isNonNegativeFiniteNumber(input.now) ||
    !isNonNegativeFiniteNumber(lastAlertAt) ||
    !isNonNegativeFiniteNumber(input.cooldownMs)
  ) {
    return { allowed: false, reason: "invalid_input" };
  }

  if (input.now - lastAlertAt < input.cooldownMs) {
    return { allowed: false, reason: "cooldown" };
  }

  return { allowed: true, nextLastAlertAt: input.now };
}

export function evaluateSelfGuardVitals(
  selfState: SelfStateSnapshot | null,
  thresholds: SelfGuardVitalsThresholds
): SelfGuardVitalsDecision {
  if (
    !selfState ||
    !isFiniteNumber(selfState.health) ||
    !isFiniteNumber(selfState.food) ||
    !isFiniteNumber(thresholds.lowHealth) ||
    !isFiniteNumber(thresholds.criticalHealth) ||
    !isFiniteNumber(thresholds.lowFood)
  ) {
    return { available: false };
  }

  const { health, food } = selfState;
  const lowHealth = health <= thresholds.lowHealth;
  const criticalHealth = health <= thresholds.criticalHealth;
  const lowFood = food <= thresholds.lowFood;
  const shouldEatForFood = lowFood;
  const shouldEatForHealing = health < thresholds.lowHealth && food < 20;

  return {
    available: true,
    health,
    food,
    lowHealth,
    criticalHealth,
    lowFood,
    shouldEatForFood,
    shouldEatForHealing,
    shouldEatNow: thresholds.autoEat && (shouldEatForFood || shouldEatForHealing),
    shouldSetCalm: health > thresholds.lowHealth && food > thresholds.lowFood
  };
}

export function evaluateSelfGuardCoreTransitions(
  input: SelfGuardCoreTransitionInput
): SelfGuardCoreTransitions {
  const { currentBotRef, previousBotRef, previousHealth, vitals } = input;

  return {
    reconnected: Boolean(previousBotRef) && previousBotRef !== currentBotRef,
    healthDropped:
      vitals.available &&
      isFiniteNumber(previousHealth) &&
      vitals.health + 0.5 < previousHealth
  };
}

export function evaluateSelfGuardReactiveSignals(
  vitals: SelfGuardVitalsDecision,
  hasFood: boolean,
  previousFlags?: Readonly<SelfGuardReactiveFlags>
): SelfGuardReactiveDecision {
  if (!vitals.available) {
    return { available: false };
  }

  const previous = previousFlags ?? {
    lowHealth: false,
    criticalHealth: false,
    lowFood: false
  };
  const nextFlags: SelfGuardReactiveFlags = {
    lowHealth: vitals.lowHealth,
    criticalHealth: vitals.criticalHealth,
    lowFood: vitals.lowFood
  };
  const basePayload: SelfGuardReactiveSignalPayload = {
    health: vitals.health,
    food: vitals.food,
    hasFood
  };
  const signals: SelfGuardReactiveSignal[] = [];

  if (
    nextFlags.lowHealth &&
    (!previous.lowHealth || previous.criticalHealth !== nextFlags.criticalHealth)
  ) {
    if (nextFlags.criticalHealth) {
      signals.push({
        type: "low_health",
        priority: "critical",
        payload: {
          ...basePayload,
          severity: "critical",
          reason: "critical_health_threshold"
        }
      });
    } else {
      signals.push({
        type: "low_health",
        priority: "high",
        payload: {
          ...basePayload,
          severity: "warning",
          reason: "low_health_threshold"
        }
      });
    }
  }

  if (nextFlags.lowFood && !previous.lowFood) {
    signals.push({
      type: "low_food",
      priority: "high",
      payload: {
        ...basePayload,
        severity: "warning",
        reason: "low_food_threshold"
      }
    });
  }

  return {
    available: true,
    nextFlags,
    signals
  };
}

export function evaluateSelfGuardProximity(
  players: readonly PlayerSnapshot[],
  selfUsername: string | undefined,
  maxDistance: number,
  wasNear: boolean
): SelfGuardProximityDecision {
  if (!Number.isFinite(maxDistance) || maxDistance < 0) {
    throw new RangeError("Self-guard proximity max distance must be a finite non-negative number");
  }

  const isNear = players.some((player) => {
    if (player.username === selfUsername) return false;
    const distance = player.distance;
    return (
      typeof distance === "number" &&
      Number.isFinite(distance) &&
      distance >= 0 &&
      distance <= maxDistance
    );
  });

  return {
    isNear,
    enteredNearRange: isNear && !wasNear
  };
}

export function summarizeInventorySnapshotForEvent(
  inventory: InventorySnapshot
): { summary: string; itemCount: number } {
  const grouped = new Map<string, number>();
  for (const item of inventory.items) {
    const key = String(item.name ?? "unknown");
    grouped.set(key, (grouped.get(key) ?? 0) + Number(item.count ?? 0));
  }

  return {
    summary: [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => `${name}x${count}`)
      .join("|"),
    itemCount: inventory.items.length
  };
}
