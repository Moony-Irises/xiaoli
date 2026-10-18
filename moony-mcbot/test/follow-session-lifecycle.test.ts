import assert from "node:assert/strict";
import test from "node:test";
import {
  FollowSessionLifecycle,
  type FollowSessionSubscriptionCleanup
} from "../src/runtime/follow-session-lifecycle.js";
import type { IntervalScheduler } from "../src/runtime/interval-scheduler.js";

interface FakeIntervalHandle {
  id: number;
  active: boolean;
}

class FakeIntervalScheduler implements IntervalScheduler<FakeIntervalHandle> {
  private nextId = 1;
  readonly handles: FakeIntervalHandle[] = [];
  readonly cleanupEvents: string[];

  constructor(cleanupEvents: string[] = []) {
    this.cleanupEvents = cleanupEvents;
  }

  setInterval(_callback: () => void, _delayMs: number): FakeIntervalHandle {
    const handle = { id: this.nextId, active: true };
    this.nextId += 1;
    this.handles.push(handle);
    return handle;
  }

  clearInterval(handle: FakeIntervalHandle): void {
    this.cleanupEvents.push(`clear:${handle.id}`);
    handle.active = false;
  }

  get activeHandles(): FakeIntervalHandle[] {
    return this.handles.filter((handle) => handle.active);
  }
}

interface TestSession {
  playerName: string;
  startedAt: number;
}

function createSession(playerName: string, startedAt: number): TestSession {
  return { playerName, startedAt };
}

test("follow session lifecycle exposes tracked session and activity", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(scheduler);
  const session = createSession("Judy", 100);
  const unsubscribe = () => {};

  lifecycle.trackMovement("bot-a", unsubscribe);
  const interval = { id: 1, active: true };
  scheduler.handles.push(interval);
  lifecycle.activate("bot-a", interval, session);

  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.get("bot-a"), session);
});

test("follow session lifecycle stops interval before movement subscription and session", () => {
  const cleanupEvents: string[] = [];
  const scheduler = new FakeIntervalScheduler(cleanupEvents);
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(scheduler);
  const interval = { id: 1, active: true };
  scheduler.handles.push(interval);
  const session = createSession("Judy", 100);

  lifecycle.trackMovement("bot-a", () => {
    cleanupEvents.push(`unsubscribe:active=${lifecycle.has("bot-a")}`);
  });
  lifecycle.activate("bot-a", interval, session);

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.deepEqual(cleanupEvents, ["clear:1", "unsubscribe:active=true"]);
  assert.equal(interval.active, false);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.get("bot-a"), undefined);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("follow session lifecycle returns active when only a movement subscription is tracked", () => {
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(
    new FakeIntervalScheduler()
  );
  let unsubscribeCount = 0;
  lifecycle.trackMovement("bot-a", () => {
    unsubscribeCount += 1;
  });

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.equal(unsubscribeCount, 1);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("follow session lifecycle preserves state when one-bot unsubscribe fails", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(scheduler);
  const interval = { id: 1, active: true };
  scheduler.handles.push(interval);
  lifecycle.trackMovement("bot-a", () => {
    throw new Error("unsubscribe failed");
  });
  lifecycle.activate("bot-a", interval, createSession("Judy", 100));

  assert.throws(() => lifecycle.stop("bot-a"), /unsubscribe failed/);
  assert.equal(interval.active, false);
  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.get("bot-a")?.playerName, "Judy");
});

test("follow session lifecycle releases every shutdown interval before subscriptions", () => {
  const cleanupEvents: string[] = [];
  const scheduler = new FakeIntervalScheduler(cleanupEvents);
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(scheduler);
  const first = { id: 1, active: true };
  const second = { id: 2, active: true };
  scheduler.handles.push(first, second);
  lifecycle.trackMovement("bot-a", () => cleanupEvents.push("unsubscribe:bot-a"));
  lifecycle.activate("bot-a", first, createSession("Judy", 100));
  lifecycle.trackMovement("bot-b", () => cleanupEvents.push("unsubscribe:bot-b"));
  lifecycle.activate("bot-b", second, createSession("Alice", 200));

  lifecycle.stopIntervalsForShutdown();
  assert.deepEqual(cleanupEvents, ["clear:1", "clear:2"]);
  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), true);

  const cleanup: FollowSessionSubscriptionCleanup = (botId, unsubscribe) => {
    cleanupEvents.push(`begin:${botId}`);
    unsubscribe();
    cleanupEvents.push(`end:${botId}`);
  };
  lifecycle.stopMovementSubscriptionsForShutdown(cleanup);

  assert.deepEqual(cleanupEvents, [
    "clear:1",
    "clear:2",
    "begin:bot-a",
    "unsubscribe:bot-a",
    "end:bot-a",
    "begin:bot-b",
    "unsubscribe:bot-b",
    "end:bot-b"
  ]);
  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), true);
});

test("follow session lifecycle shutdown cleanup callback can isolate subscription failures", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(scheduler);
  const first = { id: 1, active: true };
  const second = { id: 2, active: true };
  scheduler.handles.push(first, second);
  const failure = new Error("bot-a unsubscribe failed");
  lifecycle.trackMovement("bot-a", () => { throw failure; });
  lifecycle.activate("bot-a", first, createSession("Judy", 100));
  lifecycle.trackMovement("bot-b", () => {});
  lifecycle.activate("bot-b", second, createSession("Alice", 200));

  lifecycle.stopIntervalsForShutdown();
  const failures: Array<{ botId: string; error: unknown }> = [];
  lifecycle.stopMovementSubscriptionsForShutdown((botId, unsubscribe) => {
    try {
      unsubscribe();
    } catch (error) {
      failures.push({ botId, error });
    }
  });

  assert.deepEqual(failures, [{ botId: "bot-a", error: failure }]);
  assert.deepEqual(scheduler.activeHandles, []);
});

test("follow session lifecycle does not replace resources implicitly", () => {
  const cleanupEvents: string[] = [];
  const scheduler = new FakeIntervalScheduler(cleanupEvents);
  const lifecycle = new FollowSessionLifecycle<FakeIntervalHandle, TestSession>(scheduler);
  const first = { id: 1, active: true };
  const second = { id: 2, active: true };
  scheduler.handles.push(first, second);

  lifecycle.trackMovement("bot-a", () => cleanupEvents.push("unsubscribe:first"));
  lifecycle.activate("bot-a", first, createSession("Judy", 100));
  lifecycle.trackMovement("bot-a", () => cleanupEvents.push("unsubscribe:second"));
  lifecycle.activate("bot-a", second, createSession("Alice", 200));

  assert.deepEqual(cleanupEvents, []);
  assert.equal(lifecycle.get("bot-a")?.playerName, "Alice");
  assert.equal(first.active, true);
  assert.equal(second.active, true);
});
