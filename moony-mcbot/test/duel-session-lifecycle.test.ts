import assert from "node:assert/strict";
import test from "node:test";
import type { IntervalScheduler } from "../src/runtime/interval-scheduler.js";
import {
  DuelSessionLifecycle,
  type DuelSessionSubscriptionCleanup
} from "../src/runtime/duel-session-lifecycle.js";

interface FakeIntervalHandle {
  id: number;
  active: boolean;
}

interface TestDuelSession {
  targetId: number;
  targetName: string;
}

class FakeIntervalScheduler implements IntervalScheduler<FakeIntervalHandle> {
  readonly cleared: number[] = [];

  setInterval(): FakeIntervalHandle {
    throw new Error("setInterval is not used by this lifecycle");
  }

  clearInterval(handle: FakeIntervalHandle): void {
    handle.active = false;
    this.cleared.push(handle.id);
  }
}

function createHandle(id: number): FakeIntervalHandle {
  return { id, active: true };
}

function createSession(targetId: number, targetName: string): TestDuelSession {
  return { targetId, targetName };
}

test("duel session lifecycle stores and updates sessions per bot", () => {
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(
    new FakeIntervalScheduler()
  );
  const first = createSession(1, "zombie");
  const updated = createSession(1, "husk");

  lifecycle.setSession("bot-a", first);
  lifecycle.setSession("bot-b", createSession(2, "warden"));

  assert.equal(lifecycle.get("bot-a"), first);
  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-c"), false);

  lifecycle.setSession("bot-a", updated);
  assert.equal(lifecycle.get("bot-a"), updated);
  assert.equal(lifecycle.get("bot-b")?.targetName, "warden");
});

test("duel session lifecycle stops interval, session, entity, then movement resources", () => {
  const events: string[] = [];
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(scheduler);
  const interval = createHandle(1);
  lifecycle.setSession("bot-a", createSession(1, "zombie"));
  lifecycle.trackSubscriptions("bot-a", {
    entityUnsubscribe: () => events.push(`entity:active=${interval.active}:session=${lifecycle.has("bot-a")}`),
    movementUnsubscribe: () => events.push("movement")
  });
  lifecycle.trackInterval("bot-a", interval);

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.deepEqual(scheduler.cleared, [1]);
  assert.deepEqual(events, ["entity:active=false:session=false", "movement"]);
  assert.equal(lifecycle.get("bot-a"), undefined);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("duel session lifecycle preserves both subscriptions when entity cleanup throws", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(scheduler);
  const failure = new Error("entity unsubscribe failed");
  let entityCount = 0;
  let movementCount = 0;
  lifecycle.setSession("bot-a", createSession(1, "zombie"));
  lifecycle.trackSubscriptions("bot-a", {
    entityUnsubscribe: () => {
      entityCount += 1;
      throw failure;
    },
    movementUnsubscribe: () => { movementCount += 1; }
  });
  lifecycle.trackInterval("bot-a", createHandle(1));

  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.deepEqual(scheduler.cleared, [1]);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(movementCount, 0);

  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.equal(entityCount, 2);
  assert.equal(movementCount, 0);
});

test("duel session lifecycle preserves subscription registration when movement cleanup throws", () => {
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(
    new FakeIntervalScheduler()
  );
  const failure = new Error("movement unsubscribe failed");
  let entityCount = 0;
  let movementCount = 0;
  lifecycle.setSession("bot-a", createSession(1, "zombie"));
  lifecycle.trackSubscriptions("bot-a", {
    entityUnsubscribe: () => { entityCount += 1; },
    movementUnsubscribe: () => {
      movementCount += 1;
      throw failure;
    }
  });

  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.equal(entityCount, 2);
  assert.equal(movementCount, 2);
});

test("duel session lifecycle performs shutdown cleanup in two phases and keeps sessions", () => {
  const events: string[] = [];
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(scheduler);
  const first = createHandle(1);
  const second = createHandle(2);

  for (const [botId, handle] of [["bot-a", first], ["bot-b", second]] as const) {
    lifecycle.setSession(botId, createSession(handle.id, botId));
    lifecycle.trackSubscriptions(botId, {
      entityUnsubscribe: () => events.push(`entity:${botId}`),
      movementUnsubscribe: () => events.push(`movement:${botId}`)
    });
    lifecycle.trackInterval(botId, handle);
  }

  lifecycle.stopIntervalsForShutdown();
  events.push(`intervals:${first.active},${second.active}`);
  const cleanup: DuelSessionSubscriptionCleanup = (botId, kind, unsubscribe) => {
    events.push(`begin:${botId}:${kind}`);
    unsubscribe();
    events.push(`end:${botId}:${kind}`);
  };
  lifecycle.stopSubscriptionsForShutdown(cleanup);

  assert.deepEqual(scheduler.cleared, [1, 2]);
  assert.deepEqual(events, [
    "intervals:false,false",
    "begin:bot-a:entity",
    "entity:bot-a",
    "end:bot-a:entity",
    "begin:bot-a:movement",
    "movement:bot-a",
    "end:bot-a:movement",
    "begin:bot-b:entity",
    "entity:bot-b",
    "end:bot-b:entity",
    "begin:bot-b:movement",
    "movement:bot-b",
    "end:bot-b:movement"
  ]);
  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), true);
});

test("duel session lifecycle lets shutdown callers isolate each subscription failure", () => {
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(
    new FakeIntervalScheduler()
  );
  const entityFailure = new Error("entity failed");
  const movementFailure = new Error("movement failed");
  lifecycle.trackSubscriptions("bot-a", {
    entityUnsubscribe: () => { throw entityFailure; },
    movementUnsubscribe: () => { throw movementFailure; }
  });
  lifecycle.trackSubscriptions("bot-b", {
    entityUnsubscribe: () => undefined,
    movementUnsubscribe: () => undefined
  });

  const failures: Array<{ botId: string; kind: string; error: unknown }> = [];
  lifecycle.stopSubscriptionsForShutdown((botId, kind, unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      failures.push({ botId, kind, error });
    }
  });

  assert.deepEqual(failures, [
    { botId: "bot-a", kind: "entity", error: entityFailure },
    { botId: "bot-a", kind: "movement", error: movementFailure }
  ]);
  assert.equal(lifecycle.stop("bot-a"), false);
  assert.equal(lifecycle.stop("bot-b"), false);
});

test("duel session lifecycle does not clean replaced resources implicitly", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new DuelSessionLifecycle<FakeIntervalHandle, TestDuelSession>(scheduler);
  const first = createHandle(1);
  const second = createHandle(2);
  let firstEntityCount = 0;
  let secondEntityCount = 0;

  lifecycle.setSession("bot-a", createSession(1, "zombie"));
  lifecycle.trackSubscriptions("bot-a", {
    entityUnsubscribe: () => { firstEntityCount += 1; },
    movementUnsubscribe: () => undefined
  });
  lifecycle.trackInterval("bot-a", first);

  lifecycle.setSession("bot-a", createSession(2, "warden"));
  lifecycle.trackSubscriptions("bot-a", {
    entityUnsubscribe: () => { secondEntityCount += 1; },
    movementUnsubscribe: () => undefined
  });
  lifecycle.trackInterval("bot-a", second);

  assert.equal(first.active, true);
  assert.equal(firstEntityCount, 0);
  assert.equal(lifecycle.get("bot-a")?.targetName, "warden");

  lifecycle.stop("bot-a");
  assert.equal(first.active, true);
  assert.equal(second.active, false);
  assert.equal(firstEntityCount, 0);
  assert.equal(secondEntityCount, 1);
});
