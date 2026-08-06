import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSnapshot } from "../src/runtime/client-adapter.js";
import { selectNearestWhitelistedPlayer } from "../src/runtime/player-selection.js";

function player(
  username: string,
  distance: number | undefined,
  position: PlayerSnapshot["position"]
): PlayerSnapshot {
  return { username, distance, position };
}

test("selectNearestWhitelistedPlayer chooses the nearest valid whitelisted snapshot", () => {
  const players: PlayerSnapshot[] = [
    player("Stranger", 1, { x: 1, y: 64, z: 0 }),
    player("Judy", 8, { x: 8, y: 64, z: 0 }),
    player("Friend", 3, { x: 3, y: 64, z: 0 })
  ];

  assert.deepEqual(
    selectNearestWhitelistedPlayer(players, new Set(["Judy", "Friend"])),
    players[2]
  );
});

test("selectNearestWhitelistedPlayer skips snapshots without finite distance and position", () => {
  const valid = player("Valid", 7, { x: 7, y: 64, z: 0 });
  const players: PlayerSnapshot[] = [
    player("MissingDistance", undefined, { x: 1, y: 64, z: 0 }),
    player("InfiniteDistance", Number.POSITIVE_INFINITY, { x: 2, y: 64, z: 0 }),
    player("MissingPosition", 2, undefined),
    player("InvalidPosition", 3, { x: Number.NaN, y: 64, z: 0 }),
    valid
  ];

  assert.equal(
    selectNearestWhitelistedPlayer(players, new Set(players.map((entry) => entry.username))),
    valid
  );
});

test("selectNearestWhitelistedPlayer preserves input order for equal distances", () => {
  const first = player("First", 4, { x: 4, y: 64, z: 0 });
  const second = player("Second", 4, { x: -4, y: 64, z: 0 });

  assert.equal(
    selectNearestWhitelistedPlayer([first, second], new Set(["First", "Second"])),
    first
  );
});

test("selectNearestWhitelistedPlayer returns null when no valid whitelist target exists", () => {
  assert.equal(
    selectNearestWhitelistedPlayer(
      [player("Stranger", 1, { x: 1, y: 64, z: 0 })],
      new Set(["Judy"])
    ),
    null
  );
});
