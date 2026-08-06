import { SafePathError } from "./mining-approach.js";

export type FollowMovement = "search" | "out_of_range" | "approach" | "hold";

export interface FollowPursuitFailure {
  detail: string;
  chatMessage: string;
}

export interface FollowDistanceConfig {
  minDistance: number;
  maxDistance: number;
}

export interface FollowTickObservation {
  targetVisible: boolean;
  horizontalDistance?: number;
}

export function decideFollowMovement(
  config: FollowDistanceConfig,
  observation: FollowTickObservation
): FollowMovement {
  if (!Number.isFinite(config.minDistance) || config.minDistance <= 0) {
    throw new Error("minDistance must be greater than zero");
  }
  if (!Number.isFinite(config.maxDistance) || config.maxDistance < config.minDistance) {
    throw new Error("maxDistance must be greater than or equal to minDistance");
  }
  if (
    !observation.targetVisible ||
    typeof observation.horizontalDistance !== "number" ||
    !Number.isFinite(observation.horizontalDistance) ||
    observation.horizontalDistance < 0
  ) {
    return "search";
  }
  if (observation.horizontalDistance > config.maxDistance) {
    return "out_of_range";
  }
  if (observation.horizontalDistance > config.minDistance) {
    return "approach";
  }
  return "hold";
}

export function getFollowPursuitFailure(error: unknown): FollowPursuitFailure | null {
  if (!(error instanceof SafePathError)) return null;
  return {
    detail: `cannot safely follow (${error.reason})`,
    chatMessage: "我跟不上你啦"
  };
}
