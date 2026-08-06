import type { PlayerSnapshot } from "./client-adapter.js";

export interface PositionedPlayerSnapshot extends PlayerSnapshot {
  distance: number;
  position: NonNullable<PlayerSnapshot["position"]>;
}

function isPositionedPlayerSnapshot(player: PlayerSnapshot): player is PositionedPlayerSnapshot {
  const position = player.position;
  return (
    typeof player.distance === "number" &&
    Number.isFinite(player.distance) &&
    player.distance >= 0 &&
    Boolean(
      position &&
      Number.isFinite(position.x) &&
      Number.isFinite(position.y) &&
      Number.isFinite(position.z)
    )
  );
}

export function selectNearestWhitelistedPlayer(
  players: readonly PlayerSnapshot[],
  whitelist: ReadonlySet<string>
): PositionedPlayerSnapshot | null {
  let nearest: PositionedPlayerSnapshot | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const player of players) {
    if (!whitelist.has(player.username) || !isPositionedPlayerSnapshot(player)) {
      continue;
    }

    if (player.distance < nearestDistance) {
      nearest = player;
      nearestDistance = player.distance;
    }
  }

  return nearest;
}
