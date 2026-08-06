import type { PositionCoordinates } from "./position-movement.js";

export type SafePathStatus = "noPath" | "timeout" | "success" | "partial";
export type SafeRouteFailureReason = "no_path" | "path_timeout" | "detour_too_long" | "approach_timeout";
export type SafePathFailureReason = SafeRouteFailureReason | "pathfinder_unavailable" | "goal_rejected";
export type MiningPathStatus = SafePathStatus;
export type MiningApproachFailureReason = SafeRouteFailureReason;

export type SafePathNode = PositionCoordinates;
export type MiningPathNode = SafePathNode;

export interface SafePathAssessment {
  outcome: "continue" | "approach_unreachable";
  reason?: SafeRouteFailureReason;
  directDistance: number;
  routeDistance: number;
  maxRouteDistance: number;
}
export type MiningApproachAssessment = SafePathAssessment;

export class SafePathError extends Error {
  constructor(
    readonly reason: SafePathFailureReason,
    context: string
  ) {
    super(`safe path ${reason}: ${context}`);
    this.name = "SafePathError";
  }
}

function assertFinitePosition(label: string, position: PositionCoordinates): void {
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new Error(`${label} requires finite x/y/z coordinates`);
  }
}

export function getMaxMiningRouteDistance(directDistance: number): number {
  if (!Number.isFinite(directDistance) || directDistance < 0) {
    throw new Error("directDistance must be a non-negative finite number");
  }
  return Math.max(24, directDistance * 2.5);
}

export function calculateRouteDistance(start: PositionCoordinates, path: SafePathNode[]): number {
  assertFinitePosition("Route start", start);
  let distance = 0;
  let previous = start;
  for (const node of path) {
    assertFinitePosition("Route node", node);
    distance += Math.hypot(node.x - previous.x, node.y - previous.y, node.z - previous.z);
    previous = node;
  }
  return distance;
}

export function assessSafePathUpdate(
  current: PositionCoordinates,
  target: PositionCoordinates,
  status: SafePathStatus,
  path: SafePathNode[]
): SafePathAssessment {
  assertFinitePosition("Current position", current);
  assertFinitePosition("Target position", target);
  const directDistance = Math.hypot(target.x - current.x, target.y - current.y, target.z - current.z);
  const routeDistance = calculateRouteDistance(current, path);
  const maxRouteDistance = getMaxMiningRouteDistance(directDistance);

  if (status === "noPath" || status === "timeout") {
    return {
      outcome: "approach_unreachable",
      reason: status === "noPath" ? "no_path" : "path_timeout",
      directDistance,
      routeDistance,
      maxRouteDistance
    };
  }
  if (routeDistance > maxRouteDistance) {
    return {
      outcome: "approach_unreachable",
      reason: "detour_too_long",
      directDistance,
      routeDistance,
      maxRouteDistance
    };
  }
  return {
    outcome: "continue",
    directDistance,
    routeDistance,
    maxRouteDistance
  };
}

export function assessMiningPathUpdate(
  current: PositionCoordinates,
  target: PositionCoordinates,
  status: MiningPathStatus,
  path: MiningPathNode[]
): MiningApproachAssessment {
  return assessSafePathUpdate(current, target, status, path);
}
