import type { EntitySnapshot } from "./client-adapter.js";

export interface DuelSessionState {
  targetId: number;
  targetName: string;
  requester: string;
  startedAt: number;
  lastAttackAt: number;
  lastSeenAt: number;
}

export interface DuelTickObservation {
  selfHealth: number;
  targetVisible: boolean;
  targetDistance?: number;
}

export interface DuelTickConfig {
  lostTargetTimeoutMs: number;
  approachDistance: number;
  attackDistance: number;
  attackCooldownMs: number;
}

export interface DuelTickDecision {
  outcome: "continue" | "failed" | "cancelled";
  movement: "none" | "approach" | "hold";
  shouldAttack: boolean;
  detail: string;
  nextSession: DuelSessionState;
}

export const DEFAULT_DUEL_TICK_CONFIG: Readonly<DuelTickConfig> = {
  lostTargetTimeoutMs: 2500,
  approachDistance: 3,
  attackDistance: 4.5,
  attackCooldownMs: 650
};

function normalizeLooseText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，,。.!！?？:：;；'"“”‘’\s]/g, "")
    .trim();
}

function resolveMobAliasTokens(targetText: string): string[] {
  const normalizedTarget = normalizeLooseText(targetText);
  const aliases: Record<string, string[]> = {
    监守者: ["warden"],
    苦力怕: ["creeper"],
    僵尸: ["zombie"],
    小白: ["skeleton"],
    骷髅: ["skeleton"],
    末影人: ["enderman"],
    蜘蛛: ["spider"],
    凋灵骷髅: ["wither_skeleton", "witherskeleton"],
    烈焰人: ["blaze"],
    史莱姆: ["slime"],
    女巫: ["witch"],
    掠夺者: ["pillager"],
    卫道士: ["vindicator"],
    唤魔者: ["evoker"]
  };
  const tokens = new Set<string>([normalizedTarget]);
  for (const [alias, values] of Object.entries(aliases)) {
    if (!normalizedTarget.includes(normalizeLooseText(alias))) continue;
    for (const value of values) tokens.add(value);
  }
  return [...tokens].filter(Boolean);
}

export function findChallengeTargetSnapshot(
  entities: readonly EntitySnapshot[],
  targetText: string,
  maxDistance = 16
): EntitySnapshot | null {
  const tokens = resolveMobAliasTokens(targetText);
  return entities
    .filter((entity) => entity.type !== "player")
    .filter((entity) => typeof entity.distance === "number" && entity.distance <= maxDistance)
    .filter((entity) => {
      const joined = normalizeLooseText(
        `${entity.name ?? ""} ${entity.displayName ?? ""} ${entity.kind ?? ""} ${entity.type ?? ""}`
      );
      return tokens.some((token) => joined.includes(token));
    })
    .sort((left, right) => (left.distance ?? Number.POSITIVE_INFINITY) - (right.distance ?? Number.POSITIVE_INFINITY))[0] ?? null;
}

export function decideDuelTick(
  session: DuelSessionState,
  observation: DuelTickObservation,
  now: number,
  config: Readonly<DuelTickConfig> = DEFAULT_DUEL_TICK_CONFIG
): DuelTickDecision {
  if (observation.selfHealth <= 0) {
    return {
      outcome: "failed",
      movement: "none",
      shouldAttack: false,
      detail: "bot health reached zero during duel",
      nextSession: { ...session }
    };
  }

  if (!observation.targetVisible || typeof observation.targetDistance !== "number") {
    const targetLost = now - session.lastSeenAt > config.lostTargetTimeoutMs;
    return {
      outcome: targetLost ? "cancelled" : "continue",
      movement: "none",
      shouldAttack: false,
      detail: targetLost ? `lost sight of ${session.targetName}` : `waiting for ${session.targetName}`,
      nextSession: { ...session }
    };
  }

  const shouldAttack =
    observation.targetDistance <= config.attackDistance &&
    now - session.lastAttackAt >= config.attackCooldownMs;
  return {
    outcome: "continue",
    movement: observation.targetDistance > config.approachDistance ? "approach" : "hold",
    shouldAttack,
    detail: `attacking ${session.targetName} (${observation.targetDistance.toFixed(1)} blocks away)`,
    nextSession: {
      ...session,
      lastSeenAt: now,
      lastAttackAt: shouldAttack ? now : session.lastAttackAt
    }
  };
}
