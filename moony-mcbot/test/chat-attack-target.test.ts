import assert from "node:assert/strict";
import test from "node:test";
import {
  decidePlayerAttackAction,
  extractRequestedPlayerName,
  findMentionedPlayerSnapshot
} from "../src/runtime/chat-attack-target.js";

test("findMentionedPlayerSnapshot matches usernames case-insensitively", () => {
  const result = findMentionedPlayerSnapshot("小狸，攻击 jUdY", [
    { username: "Admin", distance: 2 },
    { username: "Judy", distance: 6 }
  ]);

  assert.deepEqual(result, { username: "Judy", distance: 6 });
});

test("findMentionedPlayerSnapshot returns the first matching snapshot", () => {
  const result = findMentionedPlayerSnapshot("攻击 Judy，不要攻击 Admin", [
    { username: "Judy", distance: 3 },
    { username: "Admin", distance: 2 }
  ]);

  assert.deepEqual(result, { username: "Judy", distance: 3 });
});

test("findMentionedPlayerSnapshot ignores empty usernames and missing targets", () => {
  assert.equal(findMentionedPlayerSnapshot("攻击附近目标", [
    { username: "", distance: 1 },
    { username: "Judy", distance: 2 }
  ]), null);
});

test("extractRequestedPlayerName reads a Minecraft username after an attack phrase", () => {
  assert.equal(extractRequestedPlayerName("小狸，攻击 Judy_01", ["攻击", "打一下"]), "Judy_01");
  assert.equal(extractRequestedPlayerName("小狸，打一下附近目标", ["攻击", "打一下"]), null);
  assert.equal(extractRequestedPlayerName("小狸，攻击 AB", ["攻击"]), null);
});

test("decidePlayerAttackAction preserves the 4.5 block one-hit boundary", () => {
  const position = { x: 1, y: 64, z: 1 };

  assert.deepEqual(decidePlayerAttackAction({
    username: "Judy",
    entityId: 7,
    distance: 4.5,
    position
  }), { action: "attack" });
  assert.deepEqual(decidePlayerAttackAction({
    username: "Judy",
    entityId: 7,
    distance: 4.51,
    position
  }), { action: "approach", entityId: 7 });
});

test("decidePlayerAttackAction rejects incomplete remote target snapshots", () => {
  assert.deepEqual(decidePlayerAttackAction({
    username: "Judy",
    distance: 8
  }), {
    action: "unavailable",
    reason: "missing_position_or_distance"
  });
  assert.deepEqual(decidePlayerAttackAction({
    username: "Judy",
    distance: 8,
    position: { x: 8, y: 64, z: 0 }
  }), {
    action: "unavailable",
    reason: "missing_entity_id"
  });
  assert.throws(() => decidePlayerAttackAction({
    username: "Judy",
    entityId: 7,
    distance: 2,
    position: { x: 2, y: 64, z: 0 }
  }, 0), /greater than zero/);
});
