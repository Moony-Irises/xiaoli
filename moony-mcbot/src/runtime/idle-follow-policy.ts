import type { PlayerSnapshot } from "./client-adapter.js";
import type { PositionCoordinates } from "./position-movement.js";

const OWNER_FOLLOW_TRIGGER_DISTANCE = 4.5;
const OWNER_SPRINT_DISTANCE = 8;
const FALLBACK_MOVE_TRIGGER_DISTANCE = 3.5;

export interface IdleFollowFallbackTarget extends PositionCoordinates {
  placeId: string;
  label: string;
}

export type IdleFollowDecision =
  | {
      action: "follow_owner";
      distance: number;
      sprint: boolean;
    }
  | {
      action: "return_to_place";
      distance: number;
      target: IdleFollowFallbackTarget;
    }
  | {
      action: "none";
      reason: "owner_nearby" | "already_at_fallback" | "no_fallback";
    };

function isFinitePosition(position: PositionCoordinates | undefined): position is PositionCoordinates {
  return Boolean(
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z)
  );
}

function requireFinitePosition(label: string, position: PositionCoordinates): void {
  if (!isFinitePosition(position)) {
    throw new Error(`${label} position requires finite x/y/z coordinates`);
  }
}

function distanceBetween(current: PositionCoordinates, target: PositionCoordinates): number {
  return Math.hypot(target.x - current.x, target.y - current.y, target.z - current.z);
}

export function decideIdleFollowAction(
  current: PositionCoordinates,
  owner: PlayerSnapshot | null,
  fallback: IdleFollowFallbackTarget | null
): IdleFollowDecision {
  requireFinitePosition("Current", current);

  if (isFinitePosition(owner?.position)) {
    const distance = distanceBetween(current, owner.position);
    if (distance <= OWNER_FOLLOW_TRIGGER_DISTANCE) {
      return { action: "none", reason: "owner_nearby" };
    }
    return {
      action: "follow_owner",
      distance,
      sprint: distance > OWNER_SPRINT_DISTANCE
    };
  }

  if (!fallback || !isFinitePosition(fallback)) {
    return { action: "none", reason: "no_fallback" };
  }

  const distance = distanceBetween(current, fallback);
  if (distance <= FALLBACK_MOVE_TRIGGER_DISTANCE) {
    return { action: "none", reason: "already_at_fallback" };
  }
  return {
    action: "return_to_place",
    distance,
    target: fallback
  };
}
