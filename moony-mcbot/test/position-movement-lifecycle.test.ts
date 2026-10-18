import assert from "node:assert/strict";
import test from "node:test";
import type { IntervalScheduler } from "../src/runtime/interval-scheduler.js";
import {
  PositionMovementLifecycle,
  type PositionMovementSubscriptionCleanup
} from "../src/runtime/position-movement-lifecycle.js";

interface FakeIntervalHandle {
  id: number;
  active: boolean;
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

test("position movement lifecycle tracks the current interval per bot", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new PositionMovementLifecycle(scheduler);
  const first = createHandle(1);
  const second = createHandle(2);

  lifecycle.activate("bot-a", first, () => undefined);
  lifecycle.activate("bot-b", second, () => undefined);

  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), true);
  assert.equal(lifecycle.has("bot-c"), false);
  assert.equal(lifecycle.isCurrent("bot-a", first), true);
  assert.equal(lifecycle.isCurrent("bot-a", second), false);
});

test("position movement lifecycle stops interval before movement subscription", () => {
  const events: string[] = [];
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new PositionMovementLifecycle(scheduler);
  const handle = createHandle(1);
  lifecycle.activate("bot-a", handle, () => {
    events.push(`unsubscribe:active=${handle.active}`);
  });

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.deepEqual(scheduler.cleared, [1]);
  assert.deepEqual(events, ["unsubscribe:active=false"]);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.isCurrent("bot-a", handle), false);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("position movement lifecycle preserves the subscription when unsubscribe throws", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new PositionMovementLifecycle(scheduler);
  const handle = createHandle(1);
  let unsubscribeCount = 0;
  const failure = new Error("unsubscribe failed");
  lifecycle.activate("bot-a", handle, () => {
    unsubscribeCount += 1;
    throw failure;
  });

  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.deepEqual(scheduler.cleared, [1]);
  assert.equal(lifecycle.has("bot-a"), false);

  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.equal(unsubscribeCount, 2);
  assert.deepEqual(scheduler.cleared, [1]);
});

test("position movement lifecycle performs shutdown cleanup in two phases", () => {
  const events: string[] = [];
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new PositionMovementLifecycle(scheduler);
  const first = createHandle(1);
  const second = createHandle(2);
  lifecycle.activate("bot-a", first, () => events.push("unsubscribe:bot-a"));
  lifecycle.activate("bot-b", second, () => events.push("unsubscribe:bot-b"));

  lifecycle.stopIntervalsForShutdown();
  events.push(`intervals:${first.active},${second.active}`);

  const cleanup: PositionMovementSubscriptionCleanup = (botId, unsubscribe) => {
    events.push(`begin:${botId}`);
    unsubscribe();
    events.push(`end:${botId}`);
  };
  lifecycle.stopMovementSubscriptionsForShutdown(cleanup);

  assert.deepEqual(scheduler.cleared, [1, 2]);
  assert.deepEqual(events, [
    "intervals:false,false",
    "begin:bot-a",
    "unsubscribe:bot-a",
    "end:bot-a",
    "begin:bot-b",
    "unsubscribe:bot-b",
    "end:bot-b"
  ]);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.has("bot-b"), false);
});

test("position movement lifecycle lets shutdown callers isolate unsubscribe failures", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new PositionMovementLifecycle(scheduler);
  const failure = new Error("bot-a unsubscribe failed");
  lifecycle.activate("bot-a", createHandle(1), () => { throw failure; });
  lifecycle.activate("bot-b", createHandle(2), () => undefined);

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
  assert.equal(lifecycle.stop("bot-a"), false);
  assert.equal(lifecycle.stop("bot-b"), false);
});

test("position movement lifecycle does not clean replaced resources implicitly", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new PositionMovementLifecycle(scheduler);
  const first = createHandle(1);
  const second = createHandle(2);
  let firstUnsubscribeCount = 0;
  let secondUnsubscribeCount = 0;

  lifecycle.activate("bot-a", first, () => { firstUnsubscribeCount += 1; });
  lifecycle.activate("bot-a", second, () => { secondUnsubscribeCount += 1; });

  assert.equal(first.active, true);
  assert.equal(lifecycle.isCurrent("bot-a", first), false);
  assert.equal(lifecycle.isCurrent("bot-a", second), true);
  assert.equal(firstUnsubscribeCount, 0);

  lifecycle.stop("bot-a");
  assert.equal(second.active, false);
  assert.equal(first.active, true);
  assert.equal(firstUnsubscribeCount, 0);
  assert.equal(secondUnsubscribeCount, 1);
});
