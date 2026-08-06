import assert from "node:assert/strict";
import test from "node:test";
import {
  RetaliationStateStore,
  type RetaliationSessionState
} from "../src/runtime/retaliation-state-store.js";

function session(overrides: Partial<RetaliationSessionState> = {}): RetaliationSessionState {
  return {
    attackerName: "attacker-a",
    remainingHits: 6,
    lastAttackAt: 0,
    startedAt: 1000,
    ...overrides
  };
}

test("retaliation state store preserves current session reference semantics", () => {
  const store = new RetaliationStateStore();
  const activeSession = session();

  store.setSession("bot-a", activeSession);
  assert.strictEqual(store.getSession("bot-a"), activeSession);

  activeSession.remainingHits -= 1;
  assert.equal(store.getSession("bot-a")?.remainingHits, 5);
  assert.equal(store.deleteSession("bot-a"), true);
  assert.equal(store.deleteSession("bot-a"), false);
  assert.equal(store.getSession("bot-a"), undefined);
});

test("retaliation hit streaks stay isolated by bot and attacker", () => {
  const store = new RetaliationStateStore();

  assert.equal(store.recordHit("bot-a", "attacker-a", 1000, 5000), 1);
  assert.equal(store.recordHit("bot-a", "attacker-a", 1500, 5000), 2);
  assert.equal(store.recordHit("bot-a", "attacker-b", 1500, 5000), 1);
  assert.equal(store.recordHit("bot-b", "attacker-a", 1500, 5000), 1);
});

test("retaliation hit streaks expire at the configured decay boundary", () => {
  const store = new RetaliationStateStore();
  store.recordHit("bot-a", "attacker-a", 1000, 1000);
  store.recordHit("bot-a", "attacker-b", 1500, 1000);

  assert.equal(store.pruneExpiredHits("bot-a", 1999, 1000), 0);
  assert.equal(store.pruneExpiredHits("bot-a", 2000, 1000), 1);
  assert.equal(store.recordHit("bot-a", "attacker-a", 2000, 1000), 1);
  assert.equal(store.recordHit("bot-a", "attacker-b", 2000, 1000), 2);
});

test("retaliation state store clears only the requested bot", () => {
  const store = new RetaliationStateStore();
  store.setSession("bot-a", session());
  store.setSession("bot-b", session({ attackerName: "attacker-b" }));
  store.recordHit("bot-a", "attacker-a", 1000, 5000);
  store.recordHit("bot-b", "attacker-b", 1000, 5000);

  assert.equal(store.clearBot("bot-a"), true);
  assert.equal(store.clearBot("bot-a"), false);
  assert.equal(store.getSession("bot-a"), undefined);
  assert.equal(store.getSession("bot-b")?.attackerName, "attacker-b");
  assert.equal(store.recordHit("bot-a", "attacker-a", 1500, 5000), 1);
  assert.equal(store.recordHit("bot-b", "attacker-b", 1500, 5000), 2);
});

test("retaliation state store rejects invalid hit timing inputs", () => {
  const store = new RetaliationStateStore();

  assert.throws(() => store.recordHit("bot-a", "  ", 1000, 5000), TypeError);
  assert.throws(() => store.recordHit("bot-a", "attacker-a", Number.NaN, 5000), RangeError);
  assert.throws(() => store.recordHit("bot-a", "attacker-a", 1000, 0), RangeError);
  assert.throws(
    () => store.pruneExpiredHits("bot-a", Number.POSITIVE_INFINITY, 5000),
    RangeError
  );
  assert.equal(store.clearBot("bot-a"), false);
});
