import type { EntitySnapshot, PlayerSnapshot } from "./client-adapter.js";

interface PositionSnapshot {
  x: number;
  y: number;
  z: number;
}

export interface SalientNearbyPlayer {
  username: string;
  relation: "whitelist" | "neutral";
  distance: number;
  position: PositionSnapshot;
}

export interface SalientInterestingEntity {
  entityId?: number;
  name: string;
  displayName: string | null;
  type: string;
  kind: string | null;
  distance: number;
  position: PositionSnapshot;
}

export interface SalientActorsInput {
  players: PlayerSnapshot[];
  entities: EntitySnapshot[];
  whitelist: ReadonlySet<string>;
  selfUsername?: string;
  radius: number;
}

export interface SalientActorsSnapshot {
  nearbyPlayers: SalientNearbyPlayer[];
  interestingEntities: SalientInterestingEntity[];
}

interface PositionedPlayer extends PlayerSnapshot {
  distance: number;
  position: PositionSnapshot;
}

interface PositionedEntity extends EntitySnapshot {
  distance: number;
  position: PositionSnapshot;
}

const INTERESTING_ENTITY_KEYWORDS = [
  "pillager",
  "creeper",
  "zombie",
  "skeleton",
  "boat",
  "minecart",
  "wolf"
];

function isFinitePosition(position: PositionSnapshot | undefined): position is PositionSnapshot {
  return Boolean(
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z)
  );
}

function isPositionedPlayer(player: PlayerSnapshot): player is PositionedPlayer {
  return typeof player.distance === "number" &&
    Number.isFinite(player.distance) &&
    player.distance >= 0 &&
    isFinitePosition(player.position);
}

function isPositionedEntity(entity: EntitySnapshot): entity is PositionedEntity {
  return typeof entity.distance === "number" &&
    Number.isFinite(entity.distance) &&
    entity.distance >= 0 &&
    isFinitePosition(entity.position);
}

function roundDistance(distance: number): number {
  return Number(distance.toFixed(2));
}

function isInterestingEntity(entity: SalientInterestingEntity): boolean {
  const joined = `${entity.type} ${entity.name} ${entity.displayName ?? ""} ${entity.kind ?? ""}`.toLowerCase();
  return INTERESTING_ENTITY_KEYWORDS.some((keyword) => joined.includes(keyword));
}

export function buildSalientActors(input: SalientActorsInput): SalientActorsSnapshot {
  if (!Number.isFinite(input.radius) || input.radius < 0) {
    throw new Error("Salient perception radius must be a finite non-negative number");
  }

  const nearbyPlayers = input.players
    .filter((player): player is PositionedPlayer =>
      Boolean(player.username) &&
      player.username !== input.selfUsername &&
      isPositionedPlayer(player) &&
      player.distance <= input.radius
    )
    .map((player): SalientNearbyPlayer => ({
      username: player.username,
      relation: input.whitelist.has(player.username) ? "whitelist" : "neutral",
      distance: roundDistance(player.distance),
      position: { ...player.position }
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);

  const nearbyEntities = input.entities
    .filter((entity): entity is PositionedEntity =>
      isPositionedEntity(entity) && entity.distance <= input.radius
    )
    .map((entity): SalientInterestingEntity => ({
      entityId: entity.entityId,
      name: entity.name || entity.type || "unknown",
      displayName: entity.displayName || null,
      type: entity.type || "unknown",
      kind: entity.kind || null,
      distance: roundDistance(entity.distance),
      position: { ...entity.position }
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 12);

  return {
    nearbyPlayers,
    interestingEntities: nearbyEntities.filter(isInterestingEntity).slice(0, 6)
  };
}
