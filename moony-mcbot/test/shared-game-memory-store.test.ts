import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { SharedGameMemoryStore } from "../src/memory/game-memory-store.js";
import { mergeNewerMemoryRecords } from "../src/memory/merge-records.js";

async function withTemporaryMemoryDir(run: (memoryDir: string) => Promise<void>): Promise<void> {
  const memoryDir = await mkdtemp(path.join(os.tmpdir(), "moony-mcbot-memory-test-"));
  try {
    await run(memoryDir);
  } finally {
    await rm(memoryDir, { recursive: true, force: true });
  }
}

test("shared game memory store reads missing files as empty memory", async () => {
  await withTemporaryMemoryDir(async (memoryDir) => {
    const store = new SharedGameMemoryStore(memoryDir);

    assert.deepEqual(await store.loadPlayers(), new Map());
    assert.deepEqual(await store.loadPlaces(), new Map());
    assert.deepEqual(await store.getStatus(), {
      memoryDir,
      playersPath: path.join(memoryDir, "players.json"),
      placesPath: path.join(memoryDir, "places.json"),
      playerCount: 0,
      placeCount: 0
    });
  });
});

test("shared game memory store saves normalized player and place documents atomically", async () => {
  await withTemporaryMemoryDir(async (memoryDir) => {
    const store = new SharedGameMemoryStore(memoryDir);
    await store.savePlayers([
      {
        playerName: "Judy",
        alias: "茉莉",
        relation: "owner",
        tags: ["trusted", "trusted", "important"],
        lastSeenAt: 100,
        updatedAt: 200
      }
    ]);
    await store.savePlaces([
      {
        placeId: "home",
        label: "基地",
        x: 1,
        y: 64,
        z: -2,
        dimension: "overworld",
        tags: ["home", "safe", "home"],
        updatedAt: 300
      }
    ]);

    assert.deepEqual([...await store.loadPlayers()], [["Judy", {
      playerName: "Judy",
      alias: "茉莉",
      relation: "owner",
      tags: ["trusted", "important"],
      lastSeenAt: 100,
      updatedAt: 200
    }]]);
    assert.deepEqual([...await store.loadPlaces()], [["home", {
      placeId: "home",
      label: "基地",
      x: 1,
      y: 64,
      z: -2,
      dimension: "overworld",
      tags: ["home", "safe"],
      updatedAt: 300
    }]]);
    assert.equal((await readdir(memoryDir)).some((name) => name.endsWith(".tmp")), false);
  });
});

test("shared game memory store removes temporary files when replacement fails", async () => {
  await withTemporaryMemoryDir(async (memoryDir) => {
    const store = new SharedGameMemoryStore(memoryDir);
    await mkdir(store.playersPath);

    await assert.rejects(store.savePlayers([{
      playerName: "Judy",
      relation: "owner",
      updatedAt: 200
    }]));

    assert.deepEqual(await readdir(memoryDir), ["players.json"]);
    assert.deepEqual(await readdir(store.playersPath), []);
  });
});

test("shared game memory store safely ignores malformed documents", async () => {
  await withTemporaryMemoryDir(async (memoryDir) => {
    const store = new SharedGameMemoryStore(memoryDir);
    await writeFile(store.playersPath, "{not valid json", "utf8");
    await writeFile(store.placesPath, JSON.stringify({ version: 1, places: { broken: { placeId: "broken" } } }), "utf8");

    assert.deepEqual(await store.loadPlayers(), new Map());
    assert.deepEqual(await store.loadPlaces(), new Map());
  });
});

test("shared memory import only replaces older legacy records", () => {
  const target = new Map([
    ["Judy", { updatedAt: 200, note: "legacy-newer" }],
    ["Molly", { updatedAt: 100, note: "legacy-older" }]
  ]);
  const source = new Map([
    ["Judy", { updatedAt: 100, note: "shared-older" }],
    ["Molly", { updatedAt: 300, note: "shared-newer" }],
    ["Alex", { updatedAt: 150, note: "shared-only" }]
  ]);

  const mergedCount = mergeNewerMemoryRecords(target, source, (record) => ({ ...record }));

  assert.equal(mergedCount, 2);
  assert.deepEqual([...target.entries()], [
    ["Judy", { updatedAt: 200, note: "legacy-newer" }],
    ["Molly", { updatedAt: 300, note: "shared-newer" }],
    ["Alex", { updatedAt: 150, note: "shared-only" }]
  ]);
  assert.notEqual(target.get("Molly"), source.get("Molly"));
});
