export type PathfinderMovementProfile = "safe" | "mining";

export interface PathfinderMovementSettings {
  canDig: boolean;
  allow1by1towers: boolean;
  allowFreeMotion: boolean;
  allowParkour: boolean;
  allowSprinting: boolean;
  scafoldingBlocks: number[];
  maxDropDown: number;
  placeCost: number;
}

export function applySafePathfinderMovementProfile(movements: PathfinderMovementSettings): void {
  movements.canDig = false;
  movements.allow1by1towers = false;
  movements.allowFreeMotion = false;
  movements.allowParkour = false;
  movements.allowSprinting = false;
  movements.scafoldingBlocks.length = 0;
  movements.maxDropDown = 2;
  movements.placeCost = Number.MAX_SAFE_INTEGER;
}

export function applyPathfinderMovementProfile(
  movements: PathfinderMovementSettings,
  _profile: PathfinderMovementProfile
): void {
  // Mining may dig only its explicit target after arrival; path construction is always non-destructive.
  applySafePathfinderMovementProfile(movements);
}
