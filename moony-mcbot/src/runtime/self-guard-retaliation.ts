import type { PlayerSnapshot } from "./client-adapter.js";

interface PositionSnapshot {
  x: number;
  y: number;
  z: number;
}

export interface SelfGuardRetaliationTarget extends PlayerSnapshot {
  distance: number;
  position: PositionSnapshot;
}

export interface SelfGuardRetaliationTargetInput {
  players: readonly PlayerSnapshot[];
  selfUsername?: string;
  selfPosition?: PositionSnapshot;
  maxDistance: number;
}

export interface ResolveRetaliationTargetInput {
  targetUsername: string;
  player?: PlayerSnapshot | null;
  selfPosition?: PositionSnapshot;
}

export interface RetaliationTickSessionSnapshot {
  startedAt: number;
  lastAttackAt: number;
}

export interface RetaliationTickObservation {
  targetDistance?: number;
}

export interface RetaliationTickConfig {
  maxChaseMs: number;
  approachDistance: number;
  attackDistance: number;
  attackCooldownMs: number;
}

export type RetaliationTickDecision =
  | {
      status: "timed_out" | "target_unavailable";
      movement: "stop";
      shouldAttack: false;
    }
  | {
      status: "active";
      movement: "approach" | "hold";
      shouldAttack: boolean;
    };

function isFinitePosition(position: PositionSnapshot | undefined): position is PositionSnapshot {
  return Boolean(
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z)
  );
}

function distanceBetween(left: PositionSnapshot, right: PositionSnapshot): number {
  return Math.hypot(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z
  );
}

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validateRetaliationTickInput(
  session: RetaliationTickSessionSnapshot,
  now: number,
  config: Readonly<RetaliationTickConfig>
): void {
  if (
    !isFiniteNonNegative(session.startedAt) ||
    !isFiniteNonNegative(session.lastAttackAt) ||
    !isFiniteNonNegative(now)
  ) {
    throw new RangeError("Self-guard retaliation tick timestamps must be finite non-negative numbers");
  }
  if (
    !Number.isFinite(config.maxChaseMs) ||
    config.maxChaseMs <= 0 ||
    !isFiniteNonNegative(config.approachDistance) ||
    !isFiniteNonNegative(config.attackDistance) ||
    !isFiniteNonNegative(config.attackCooldownMs)
  ) {
    throw new RangeError("Self-guard retaliation tick configuration is invalid");
  }
}

export function decideRetaliationTick(
  session: RetaliationTickSessionSnapshot,
  observation: RetaliationTickObservation,
  now: number,
  config: Readonly<RetaliationTickConfig>
): RetaliationTickDecision {
  validateRetaliationTickInput(session, now, config);

  if (now - session.startedAt >= config.maxChaseMs) {
    return {
      status: "timed_out",
      movement: "stop",
      shouldAttack: false
    };
  }

  const targetDistance = observation.targetDistance;
  if (targetDistance === undefined || !isFiniteNonNegative(targetDistance)) {
    return {
      status: "target_unavailable",
      movement: "stop",
      shouldAttack: false
    };
  }

  return {
    status: "active",
    movement: targetDistance > config.approachDistance ? "approach" : "hold",
    shouldAttack:
      targetDistance <= config.attackDistance &&
      now - session.lastAttackAt >= config.attackCooldownMs
  };
}

export function resolveRetaliationTarget(
  input: ResolveRetaliationTargetInput
): SelfGuardRetaliationTarget | null {
  if (
    input.targetUsername.trim().length === 0 ||
    input.player?.username !== input.targetUsername ||
    !isFinitePosition(input.selfPosition) ||
    !isFinitePosition(input.player.position)
  ) {
    return null;
  }

  const distance = distanceBetween(input.selfPosition, input.player.position);
  if (!Number.isFinite(distance)) {
    return null;
  }

  return {
    ...input.player,
    position: { ...input.player.position },
    distance
  };
}

export function selectLikelyRetaliationAttacker(
  input: SelfGuardRetaliationTargetInput
): SelfGuardRetaliationTarget | null {
  if (!Number.isFinite(input.maxDistance) || input.maxDistance < 0) {
    throw new Error("Self-guard retaliation max distance must be a finite non-negative number");
  }
  if (!isFinitePosition(input.selfPosition)) {
    return null;
  }

  let nearest: SelfGuardRetaliationTarget | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const player of input.players) {
    if (player.username === input.selfUsername) {
      continue;
    }

    const target = resolveRetaliationTarget({
      targetUsername: player.username,
      player,
      selfPosition: input.selfPosition
    });
    if (
      !target ||
      target.distance > input.maxDistance ||
      target.distance >= nearestDistance
    ) {
      continue;
    }

    nearest = target;
    nearestDistance = target.distance;
  }

  return nearest;
}
