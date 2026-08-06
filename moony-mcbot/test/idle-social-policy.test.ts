import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSnapshot } from "../src/runtime/client-adapter.js";
import {
  selectIdleSocialTarget,
  type IdleSocialPlayerProfile
} from "../src/runtime/idle-social-policy.js";

const now = 1_000_000;

function playerAt(username: string, distance: number): PlayerSnapshot {
  return {
    username,
    distance,
    position: { x: distance, y: 64, z: 0 }
  };
}

test("idle social target gives the owner relation priority over a nearer player", () => {
  const profiles = new Map<string, IdleSocialPlayerProfile>([
    ["Judy", { playerName: "Judy", relation: "owner" }]
  ]);

  const selected = selectIdleSocialTarget({
    players: [playerAt("Friend", 1), playerAt("Judy", 8)],
    whitelist: new Set(["Friend", "Judy"]),
    profiles,
    selfUsername: "NekoMaoLi",
    maxDistance: 10,
    now
  });

  assert.equal(selected?.username, "Judy");
  assert.equal(selected?.socialScore, 6 - 8 / 6);
});

test("idle social target applies trusted tags and recent activity bonuses", () => {
  const profiles = new Map<string, IdleSocialPlayerProfile>([
    ["Trusted", {
      playerName: "Trusted",
      tags: ["trusted"],
      lastSeenAt: now - 9 * 60_000
    }],
    ["Regular", { playerName: "Regular" }]
  ]);

  const selected = selectIdleSocialTarget({
    players: [playerAt("Regular", 1), playerAt("Trusted", 8)],
    whitelist: new Set(["Regular", "Trusted"]),
    profiles,
    maxDistance: 10,
    now
  });

  assert.equal(selected?.username, "Trusted");
  assert.equal(selected?.socialScore, 3 - 8 / 6);
});

test("idle social target keeps the distance boundary and excludes stale recency", () => {
  const profiles = new Map<string, IdleSocialPlayerProfile>([
    ["Boundary", {
      playerName: "Boundary",
      relation: "whitelist",
      lastSeenAt: now - 10 * 60_000
    }]
  ]);

  const selected = selectIdleSocialTarget({
    players: [playerAt("Boundary", 10), playerAt("Outside", 10.01)],
    whitelist: new Set(["Boundary", "Outside"]),
    profiles,
    maxDistance: 10,
    now
  });

  assert.equal(selected?.username, "Boundary");
  assert.equal(selected?.socialScore, 2 - 10 / 6);
});

test("idle social target excludes self, non-whitelist, and invalid snapshots", () => {
  const selected = selectIdleSocialTarget({
    players: [
      playerAt("NekoMaoLi", 1),
      playerAt("Stranger", 1),
      { username: "NoDistance", position: { x: 1, y: 64, z: 0 } },
      { username: "NoPosition", distance: 1 },
      playerAt("Invalid", Number.NaN)
    ],
    whitelist: new Set(["NekoMaoLi", "NoDistance", "NoPosition", "Invalid"]),
    profiles: new Map(),
    selfUsername: "NekoMaoLi",
    maxDistance: 10,
    now
  });

  assert.equal(selected, null);
});

test("idle social target uses distance as the score tie-breaker", () => {
  const selected = selectIdleSocialTarget({
    players: [playerAt("Far", 6), playerAt("Near", 0)],
    whitelist: new Set(["Far", "Near"]),
    profiles: new Map([
      ["Far", { playerName: "Far", relation: "whitelist" }],
      ["Near", { playerName: "Near", lastSeenAt: now - 1 }]
    ]),
    maxDistance: 10,
    now
  });

  assert.equal(selected?.socialScore, 1);
  assert.equal(selected?.username, "Near");
});

test("idle social target rejects invalid distance limits", () => {
  assert.throws(
    () => selectIdleSocialTarget({
      players: [],
      whitelist: new Set(),
      profiles: new Map(),
      maxDistance: -1,
      now
    }),
    /Idle social max distance must be a finite non-negative number/
  );
});
