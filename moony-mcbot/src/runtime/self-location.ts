import type { SelfStateSnapshot } from "./client-adapter.js";
import type { PositionCoordinates } from "./position-movement.js";

export interface SelfLocation {
  position: PositionCoordinates;
  roundedPosition: PositionCoordinates;
  dimension?: string;
}

export function isDimensionCompatible(
  expectedDimension?: string,
  currentDimension?: string
): boolean {
  return !expectedDimension || !currentDimension || expectedDimension === currentDimension;
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(3));
}

export function requireSelfLocation(
  selfState: SelfStateSnapshot | null,
  botId: string
): SelfLocation {
  if (!selfState) {
    throw new Error(`Bot '${botId}' self state is unavailable`);
  }

  const position = selfState.position;
  if (!position) {
    throw new Error(`Bot '${botId}' position is unavailable`);
  }
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new Error(`Bot '${botId}' position requires finite x/y/z coordinates`);
  }

  const normalizedPosition: PositionCoordinates = {
    x: position.x,
    y: position.y,
    z: position.z
  };
  const dimension = selfState.dimension?.trim() || undefined;

  return {
    position: normalizedPosition,
    roundedPosition: {
      x: roundCoordinate(position.x),
      y: roundCoordinate(position.y),
      z: roundCoordinate(position.z)
    },
    dimension
  };
}
