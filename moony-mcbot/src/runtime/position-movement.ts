export interface PositionCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface PositionMovementDecision {
  status: "arrived" | "move";
  distance: number;
  horizontalDistance: number;
  verticalDelta: number;
  pathfinderSprint: boolean;
}

function assertFinitePosition(label: string, position: PositionCoordinates): void {
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new Error(`${label} position requires finite x/y/z coordinates`);
  }
}

export function decidePositionMovement(
  current: PositionCoordinates,
  target: PositionCoordinates,
  stopRadius = 2.3
): PositionMovementDecision {
  assertFinitePosition("Current", current);
  assertFinitePosition("Target", target);
  if (!Number.isFinite(stopRadius) || stopRadius <= 0) {
    throw new Error("Position movement stopRadius must be greater than zero");
  }

  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dz = target.z - current.z;
  const horizontalDistance = Math.hypot(dx, dz);
  const distance = Math.hypot(dx, dy, dz);

  return {
    status: distance <= stopRadius ? "arrived" : "move",
    distance,
    horizontalDistance,
    verticalDelta: dy,
    pathfinderSprint: horizontalDistance > 8
  };
}
