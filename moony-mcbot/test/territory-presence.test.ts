import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSnapshot } from "../src/runtime/client-adapter.js";
import {
  evaluateTerritoryPresence,
  type TerritoryPresencePlace
} from "../src/runtime/territory-presence.js";

const home: TerritoryPresencePlace = {
  placeId: "home",
  label: "家",
  x: 0,
  y: 64,
  z: 0
};

function playerAt(username: string, entityId: number, x: number, y = 64, z = 0): PlayerSnapshot {
  return {
    username,
    entityId,
    position: { x, y, z }
  };
}

test("territory presence selects the nearest intruder and retains every active place key", () => {
  const decision = evaluateTerritoryPresence({
    players: [playerAt("Far", 10, 4), playerAt("Near", 11, 2)],
    places: [
      home,
      { placeId: "gate", label: "门口", x: 5, y: 64, z: 0 }
    ],
    radius: 4,
    ownerUsername: "Judy",
    whitelist: new Set<string>(),
    selfUsername: "NekoMaoLi",
    ownerPresencePolicy: "owner_nearby_only"
  });

  assert.deepEqual(decision.nearestIntruder, {
    username: "Far",
    entityId: 10,
    place: { placeId: "gate", label: "门口", x: 5, y: 64, z: 0 },
    distanceToPlace: 1
  });
  assert.deepEqual(decision.activePresenceKeys, [
    "gate:Far",
    "home:Near",
    "gate:Near",
    "home:Far"
  ]);
  assert.equal(decision.ownerNearby, false);
});

test("territory presence excludes self, owner, and whitelisted players", () => {
  const decision = evaluateTerritoryPresence({
    players: [
      playerAt("NekoMaoLi", 1, 0),
      playerAt("Judy", 2, 1),
      playerAt("Friend", 3, 2),
      playerAt("Intruder", 4, 3)
    ],
    places: [home],
    radius: 4,
    ownerUsername: "Judy",
    whitelist: new Set(["Friend"]),
    selfUsername: "NekoMaoLi",
    ownerPresencePolicy: "owner_nearby_only"
  });

  assert.equal(decision.nearestIntruder?.username, "Intruder");
  assert.deepEqual(decision.activePresenceKeys, ["home:Intruder"]);
  assert.equal(decision.ownerNearby, true);
});

test("territory presence includes the radius boundary and ignores incomplete snapshots", () => {
  const decision = evaluateTerritoryPresence({
    players: [
      playerAt("Boundary", 5, 4),
      { username: "NoEntity", position: { x: 1, y: 64, z: 0 } },
      { username: "NoPosition", entityId: 6 },
      playerAt("InvalidPosition", 7, Number.NaN)
    ],
    places: [home, { placeId: "broken", label: "坏地点", x: Number.NaN, y: 64, z: 0 }],
    radius: 4,
    ownerUsername: "Judy",
    whitelist: new Set<string>(),
    selfUsername: "NekoMaoLi",
    ownerPresencePolicy: "owner_nearby_only"
  });

  assert.equal(decision.nearestIntruder?.username, "Boundary");
  assert.equal(decision.nearestIntruder?.distanceToPlace, 4);
  assert.deepEqual(decision.activePresenceKeys, ["home:Boundary"]);
});

test("territory owner policy preserves nearby and always escalation behavior", () => {
  const baseInput = {
    players: [playerAt("Intruder", 8, 1), playerAt("Judy", 9, 16)],
    places: [home],
    radius: 10,
    ownerUsername: "Judy",
    whitelist: new Set<string>(),
    selfUsername: "NekoMaoLi"
  };

  assert.equal(
    evaluateTerritoryPresence({ ...baseInput, ownerPresencePolicy: "owner_nearby_only" }).ownerNearby,
    true
  );
  assert.equal(
    evaluateTerritoryPresence({
      ...baseInput,
      players: [playerAt("Intruder", 8, 1)],
      ownerPresencePolicy: "owner_nearby_only"
    }).ownerNearby,
    false
  );
  assert.equal(
    evaluateTerritoryPresence({
      ...baseInput,
      players: [playerAt("Intruder", 8, 1)],
      ownerPresencePolicy: "always"
    }).ownerNearby,
    true
  );
});

test("territory presence rejects invalid radius values", () => {
  assert.throws(
    () => evaluateTerritoryPresence({
      players: [],
      places: [home],
      radius: Number.NaN,
      ownerUsername: "Judy",
      whitelist: new Set<string>(),
      selfUsername: "NekoMaoLi",
      ownerPresencePolicy: "owner_nearby_only"
    }),
    /Territory radius must be a finite non-negative number/
  );
});
