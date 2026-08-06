import assert from "node:assert/strict";
import test from "node:test";
import { buildSalientActors } from "../src/runtime/salient-perception.js";

test("salient actors sort players and preserve whitelist relation at the radius boundary", () => {
  const result = buildSalientActors({
    players: [
      { username: "XiaoLi", distance: 0, position: { x: 0, y: 64, z: 0 } },
      { username: "Alex", distance: 12, position: { x: 12, y: 64, z: 0 } },
      { username: "Judy", distance: 3.126, position: { x: 3, y: 64, z: 0 } }
    ],
    entities: [],
    whitelist: new Set(["Judy"]),
    selfUsername: "XiaoLi",
    radius: 12
  });

  assert.deepEqual(result.nearbyPlayers, [
    {
      username: "Judy",
      relation: "whitelist",
      distance: 3.13,
      position: { x: 3, y: 64, z: 0 }
    },
    {
      username: "Alex",
      relation: "neutral",
      distance: 12,
      position: { x: 12, y: 64, z: 0 }
    }
  ]);
});

test("salient actors keep only the four nearest valid players", () => {
  const result = buildSalientActors({
    players: [5, 1, 4, 2, 3].map((distance) => ({
      username: `player_${distance}`,
      distance,
      position: { x: distance, y: 64, z: 0 }
    })),
    entities: [],
    whitelist: new Set<string>(),
    radius: 12
  });

  assert.deepEqual(
    result.nearbyPlayers.map((player) => player.username),
    ["player_1", "player_2", "player_3", "player_4"]
  );
});

test("salient actors preserve interesting entity keywords and output shape", () => {
  const result = buildSalientActors({
    players: [],
    entities: [
      {
        entityId: 7,
        name: "creeper",
        displayName: "Creeper",
        type: "mob",
        kind: "Hostile mobs",
        distance: 4.567,
        position: { x: 4, y: 64, z: 0 }
      },
      {
        entityId: 8,
        name: "cow",
        displayName: "Cow",
        type: "mob",
        distance: 2,
        position: { x: 2, y: 64, z: 0 }
      }
    ],
    whitelist: new Set<string>(),
    radius: 12
  });

  assert.deepEqual(result.interestingEntities, [
    {
      entityId: 7,
      name: "creeper",
      displayName: "Creeper",
      type: "mob",
      kind: "Hostile mobs",
      distance: 4.57,
      position: { x: 4, y: 64, z: 0 }
    }
  ]);
});

test("salient actors inspect only the nearest twelve entities before keyword filtering", () => {
  const nearbyPassive = Array.from({ length: 12 }, (_, index) => ({
    entityId: index + 1,
    name: "cow",
    type: "mob",
    distance: index + 1,
    position: { x: index + 1, y: 64, z: 0 }
  }));
  const result = buildSalientActors({
    players: [],
    entities: [
      ...nearbyPassive,
      {
        entityId: 99,
        name: "zombie",
        type: "mob",
        distance: 13,
        position: { x: 13, y: 64, z: 0 }
      }
    ],
    whitelist: new Set<string>(),
    radius: 24
  });

  assert.deepEqual(result.interestingEntities, []);
});

test("salient actors ignore incomplete snapshots and reject invalid radius", () => {
  const result = buildSalientActors({
    players: [
      { username: "missing_distance", position: { x: 1, y: 64, z: 0 } },
      { username: "bad_position", distance: 1, position: { x: Number.NaN, y: 64, z: 0 } }
    ],
    entities: [
      { name: "skeleton", type: "mob", distance: 2 },
      { name: "boat", type: "object", distance: Number.POSITIVE_INFINITY, position: { x: 2, y: 64, z: 0 } }
    ],
    whitelist: new Set<string>(),
    radius: 12
  });

  assert.deepEqual(result, { nearbyPlayers: [], interestingEntities: [] });
  assert.throws(
    () => buildSalientActors({ players: [], entities: [], whitelist: new Set<string>(), radius: Number.NaN }),
    /finite non-negative/
  );
});
