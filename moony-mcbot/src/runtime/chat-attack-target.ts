import type { PlayerSnapshot } from "./client-adapter.js";

export type PlayerAttackActionDecision =
  | {
      action: "unavailable";
      reason: "missing_position_or_distance" | "missing_entity_id";
    }
  | {
      action: "attack";
    }
  | {
      action: "approach";
      entityId: number;
    };

export function findMentionedPlayerSnapshot(
  message: string,
  players: readonly PlayerSnapshot[]
): PlayerSnapshot | null {
  const normalizedMessage = message.toLowerCase();
  return players.find((player) => {
    const normalizedUsername = player.username.trim().toLowerCase();
    return normalizedUsername.length > 0 && normalizedMessage.includes(normalizedUsername);
  }) ?? null;
}

export function extractRequestedPlayerName(
  message: string,
  attackPhrases: readonly string[]
): string | null {
  const normalizedMessage = message.toLowerCase();
  const matchedPhrase = attackPhrases
    .map((phrase) => ({ phrase, index: normalizedMessage.indexOf(phrase.toLowerCase()) }))
    .filter((candidate) => candidate.index >= 0)
    .sort((left, right) => left.index - right.index)[0];
  if (!matchedPhrase) return null;

  const suffix = message.slice(matchedPhrase.index + matchedPhrase.phrase.length);
  const match = suffix.match(/^[\s,，:：。.!！?？]*(?<username>[A-Za-z0-9_]{3,16})(?:\b|$)/);
  return match?.groups?.username ?? null;
}

export function decidePlayerAttackAction(
  player: PlayerSnapshot,
  attackDistance = 4.5
): PlayerAttackActionDecision {
  if (!Number.isFinite(attackDistance) || attackDistance <= 0) {
    throw new Error("attackDistance must be greater than zero");
  }
  if (!player.position || typeof player.distance !== "number") {
    return {
      action: "unavailable",
      reason: "missing_position_or_distance"
    };
  }
  if (player.distance <= attackDistance) {
    return { action: "attack" };
  }
  if (typeof player.entityId !== "number") {
    return {
      action: "unavailable",
      reason: "missing_entity_id"
    };
  }
  return {
    action: "approach",
    entityId: player.entityId
  };
}
