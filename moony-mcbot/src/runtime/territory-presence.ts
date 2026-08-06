import type { PlayerSnapshot } from "./client-adapter.js";

export interface TerritoryPresencePlace {
  placeId: string;
  label: string;
  x: number;
  y: number;
  z: number;
}

export interface TerritoryIntruderMatch {
  username: string;
  entityId: number;
  place: TerritoryPresencePlace;
  distanceToPlace: number;
}

export interface TerritoryPresenceDecision {
  nearestIntruder: TerritoryIntruderMatch | null;
  activePresenceKeys: string[];
  ownerNearby: boolean;
}

export interface TerritoryPresenceInput {
  players: PlayerSnapshot[];
  places: TerritoryPresencePlace[];
  radius: number;
  ownerUsername: string;
  whitelist: ReadonlySet<string>;
  selfUsername?: string;
  ownerPresencePolicy: "always" | "owner_nearby_only";
}

interface PositionCoordinates {
  x: number;
  y: number;
  z: number;
}

interface PositionedEntityPlayer extends PlayerSnapshot {
  entityId: number;
  position: PositionCoordinates;
}

function isFinitePosition(position: PositionCoordinates | undefined): position is PositionCoordinates {
  return Boolean(
    position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z)
  );
}

function isFinitePlace(place: TerritoryPresencePlace): boolean {
  return Boolean(
    place.placeId &&
    Number.isFinite(place.x) &&
    Number.isFinite(place.y) &&
    Number.isFinite(place.z)
  );
}

function distanceToPlace(position: PositionCoordinates, place: TerritoryPresencePlace): number {
  return Math.hypot(position.x - place.x, position.y - place.y, position.z - place.z);
}

function isPositionedEntityPlayer(player: PlayerSnapshot): player is PositionedEntityPlayer {
  return typeof player.entityId === "number" &&
    Number.isFinite(player.entityId) &&
    isFinitePosition(player.position);
}

export function evaluateTerritoryPresence(input: TerritoryPresenceInput): TerritoryPresenceDecision {
  if (!Number.isFinite(input.radius) || input.radius < 0) {
    throw new Error("Territory radius must be a finite non-negative number");
  }

  const places = input.places.filter(isFinitePlace);
  const intruderPlayers = input.players.filter((player): player is PositionedEntityPlayer =>
    Boolean(player.username) &&
    player.username !== input.selfUsername &&
    player.username !== input.ownerUsername &&
    !input.whitelist.has(player.username) &&
    isPositionedEntityPlayer(player)
  );

  const matches: TerritoryIntruderMatch[] = intruderPlayers.flatMap((player) =>
    places.flatMap((place) => {
      const distance = distanceToPlace(player.position, place);
      if (distance > input.radius) return [];
      return [{
        username: player.username,
        entityId: player.entityId,
        place,
        distanceToPlace: distance
      }];
    })
  );
  matches.sort((a, b) => a.distanceToPlace - b.distanceToPlace);

  const nearestIntruder = matches[0] ?? null;
  let ownerNearby = false;
  if (nearestIntruder) {
    if (input.ownerPresencePolicy === "always") {
      ownerNearby = true;
    } else {
      const owner = input.players.find((player) =>
        player.username === input.ownerUsername && isFinitePosition(player.position)
      );
      ownerNearby = Boolean(
        owner?.position &&
        distanceToPlace(owner.position, nearestIntruder.place) <= Math.max(input.radius + 6, 16)
      );
    }
  }

  return {
    nearestIntruder,
    activePresenceKeys: matches.map((match) => `${match.place.placeId}:${match.username}`),
    ownerNearby
  };
}
