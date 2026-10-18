import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentGameMemoryStateStore,
  type AgentMemoryPlaceRecord,
  type AgentMemoryPlayerProfile
} from "../src/memory/agent-game-memory-state-store.js";

function player(
  playerName: string,
  updatedAt: number,
  overrides: Partial<AgentMemoryPlayerProfile> = {}
): AgentMemoryPlayerProfile {
  return {
    playerName,
    alias: `${playerName}-${updatedAt}`,
    tags: ["trusted"],
    updatedAt,
    ...overrides
  };
}

function place(
  placeId: string,
  updatedAt: number,
  overrides: Partial<AgentMemoryPlaceRecord> = {}
): AgentMemoryPlaceRecord {
  return {
    placeId,
    label: `${placeId}-${updatedAt}`,
    x: updatedAt,
    y: 64,
    z: -updatedAt,
    tags: ["safe"],
    updatedAt,
    ...overrides
  };
}

test("agent game memory keeps bot state isolated and copies nested values", () => {
  const store = new AgentGameMemoryStateStore();
  const judy = player("Judy", 1);
  const home = place("home", 1);

  store.replaceBot("bot-a", { players: [judy], places: [home] });
  store.replaceBot("bot-b", { players: [player("Molly", 2)], places: [] });

  judy.tags?.push("mutated-input");
  home.tags?.push("mutated-input");
  const players = store.getPlayers("bot-a");
  const places = store.getPlaces("bot-a");
  players[0]?.tags?.push("mutated-output");
  places[0]?.tags?.push("mutated-output");

  assert.deepEqual(store.getPlayers("bot-a")[0]?.tags, ["trusted"]);
  assert.deepEqual(store.getPlaces("bot-a")[0]?.tags, ["safe"]);
  assert.deepEqual(store.getPlayers("bot-b").map((entry) => entry.playerName), ["Molly"]);
  assert.equal(store.getExistingPlayers("missing"), undefined);
  assert.equal(store.getExistingPlaces("missing"), undefined);
});

test("agent game memory seeds bots from shared state and imports only newer records", () => {
  const store = new AgentGameMemoryStateStore();
  store.replaceBot("bot-a", { players: [], places: [] });

  assert.deepEqual(
    store.mergeSharedSnapshot(
      { players: [player("Judy", 5)], places: [place("home", 5)] },
      ["bot-a"]
    ),
    { playerCount: 1, placeCount: 1, affectedBotCount: 1 }
  );
  store.setPlayer("bot-a", player("Judy", 10, { alias: "local" }));

  assert.deepEqual(
    store.mergeSharedSnapshot(
      { players: [player("Judy", 10, { alias: "equal-shared" })], places: [] },
      ["bot-a"]
    ),
    { playerCount: 0, placeCount: 0, affectedBotCount: 0 }
  );
  assert.equal(store.getPlayer("bot-a", "Judy")?.alias, "local");

  assert.deepEqual(
    store.mergeSharedSnapshot(
      { players: [player("Judy", 11, { alias: "newer-shared" })], places: [] },
      ["bot-a"]
    ),
    { playerCount: 1, placeCount: 0, affectedBotCount: 1 }
  );
  assert.equal(store.getPlayer("bot-a", "Judy")?.alias, "newer-shared");
  assert.equal(store.getPlayer("bot-b", "Judy")?.alias, "newer-shared");
  assert.equal(store.getPlace("bot-b", "home")?.label, "home-5");
});

test("agent game memory builds shared snapshots from the newest bot records", () => {
  const store = new AgentGameMemoryStateStore();
  store.replaceBot("bot-a", {
    players: [player("Judy", 5, { alias: "first", tags: ["a"] })],
    places: [place("home", 8, { label: "newer-home" })]
  });
  store.replaceBot("bot-b", {
    players: [player("Judy", 5, { alias: "later", tags: ["b"] })],
    places: [place("home", 7, { label: "older-home" })]
  });

  const snapshot = store.createSharedSnapshot();
  assert.equal(snapshot.players[0]?.alias, "later");
  assert.deepEqual(snapshot.players[0]?.tags, ["b"]);
  assert.equal(snapshot.places[0]?.label, "newer-home");

  snapshot.players[0]?.tags?.push("mutated-output");
  assert.deepEqual(store.getPlayer("bot-c", "Judy")?.tags, ["b"]);
  assert.equal(store.getPlace("bot-c", "home")?.label, "newer-home");
});

test("agent game memory exposes copied map snapshots for read-only policies", () => {
  const store = new AgentGameMemoryStateStore();
  store.setPlayer("bot-a", player("Judy", 1));
  store.setPlace("bot-a", place("home", 1));

  const playerSnapshot = store.getPlayerMapSnapshot("bot-a");
  const placeSnapshot = store.getPlaceMapSnapshot("bot-a");
  playerSnapshot.get("Judy")?.tags?.push("mutated-output");
  playerSnapshot.set("Molly", player("Molly", 2));
  placeSnapshot.get("home")?.tags?.push("mutated-output");
  placeSnapshot.set("mine", place("mine", 2));

  assert.deepEqual(store.getPlayer("bot-a", "Judy")?.tags, ["trusted"]);
  assert.equal(store.getPlayer("bot-a", "Molly"), undefined);
  assert.deepEqual(store.getPlace("bot-a", "home")?.tags, ["safe"]);
  assert.equal(store.getPlace("bot-a", "mine"), undefined);
});

test("agent game memory preserves explicit clear, removal, and bot deletion semantics", () => {
  const store = new AgentGameMemoryStateStore();
  store.mergeSharedSnapshot({ players: [player("Judy", 1)], places: [place("home", 1)] });

  assert.equal(store.deletePlayer("bot-a", "Judy"), true);
  assert.equal(store.deletePlayer("bot-a", "Judy"), false);
  assert.equal(store.deletePlace("bot-a", "home"), true);
  store.setPlayer("bot-a", player("Molly", 2));
  store.setPlace("bot-a", place("mine", 2));
  store.clearPlayers("bot-a");
  store.clearPlaces("bot-a");

  assert.deepEqual(store.getPlayers("bot-a"), []);
  assert.deepEqual(store.getPlaces("bot-a"), []);
  assert.deepEqual(store.getBotIds(), ["bot-a"]);
  assert.equal(store.deleteBot("bot-a"), true);
  assert.equal(store.deleteBot("bot-a"), false);
  assert.equal(store.getPlayer("bot-a", "Judy")?.playerName, "Judy");
  assert.equal(store.getPlace("bot-a", "home")?.placeId, "home");
});
