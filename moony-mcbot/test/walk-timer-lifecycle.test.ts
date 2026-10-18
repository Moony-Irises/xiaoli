import assert from "node:assert/strict";
import test from "node:test";
import type { TimeoutScheduler } from "../src/runtime/timeout-scheduler.js";
import { WalkTimerLifecycle } from "../src/runtime/walk-timer-lifecycle.js";

interface FakeTimeoutHandle {
  id: number;
  active: boolean;
  callback: () => void;
  delayMs: number;
}

class FakeTimeoutScheduler implements TimeoutScheduler<FakeTimeoutHandle> {
  readonly handles: FakeTimeoutHandle[] = [];
  readonly cleared: number[] = [];

  setTimeout(callback: () => void, delayMs: number): FakeTimeoutHandle {
    const handle: FakeTimeoutHandle = {
      id: this.handles.length + 1,
      active: true,
      callback,
      delayMs
    };
    this.handles.push(handle);
    return handle;
  }

  clearTimeout(handle: FakeTimeoutHandle): void {
    handle.active = false;
    this.cleared.push(handle.id);
  }

  elapse(handle: FakeTimeoutHandle): void {
    if (!handle.active) return;
    handle.active = false;
    handle.callback();
  }
}

test("walk timer lifecycle schedules one tracked timeout per bot", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);

  lifecycle.schedule("bot-a", 250, () => undefined);
  lifecycle.schedule("bot-b", 500, () => undefined);

  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), true);
  assert.deepEqual(scheduler.handles.map(({ id, delayMs }) => ({ id, delayMs })), [
    { id: 1, delayMs: 250 },
    { id: 2, delayMs: 500 }
  ]);
});

test("walk timer lifecycle runs elapsed work before deleting the timer record", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);
  const observations: boolean[] = [];

  lifecycle.schedule("bot-a", 100, () => {
    observations.push(lifecycle.has("bot-a"));
  });
  scheduler.elapse(scheduler.handles[0]);

  assert.deepEqual(observations, [true]);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.deepEqual(scheduler.cleared, []);
});

test("walk timer lifecycle preserves the timer record when elapsed work throws", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);
  const failure = new Error("elapsed work failed");

  lifecycle.schedule("bot-a", 100, () => {
    throw failure;
  });

  assert.throws(() => scheduler.elapse(scheduler.handles[0]), failure);
  assert.equal(lifecycle.has("bot-a"), true);
});

test("walk timer lifecycle stops a timer once and reports whether it existed", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);

  lifecycle.schedule("bot-a", 100, () => undefined);

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.equal(lifecycle.stop("bot-a"), false);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.deepEqual(scheduler.cleared, [1]);
});

test("walk timer lifecycle does not clear replaced timers implicitly", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);

  lifecycle.schedule("bot-a", 100, () => undefined);
  lifecycle.schedule("bot-a", 200, () => undefined);

  assert.equal(scheduler.handles[0].active, true);
  assert.equal(scheduler.handles[1].active, true);
  assert.deepEqual(scheduler.cleared, []);

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.equal(scheduler.handles[0].active, true);
  assert.equal(scheduler.handles[1].active, false);
  assert.deepEqual(scheduler.cleared, [2]);
});

test("walk timer lifecycle preserves stale elapsed deletion after replacement", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);

  lifecycle.schedule("bot-a", 100, () => undefined);
  lifecycle.schedule("bot-a", 200, () => undefined);
  scheduler.elapse(scheduler.handles[0]);

  assert.equal(scheduler.handles[1].active, true);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("walk timer lifecycle clears every tracked timer during shutdown", () => {
  const scheduler = new FakeTimeoutScheduler();
  const lifecycle = new WalkTimerLifecycle(scheduler);

  lifecycle.schedule("bot-a", 100, () => undefined);
  lifecycle.schedule("bot-b", 200, () => undefined);
  lifecycle.stopAll();

  assert.deepEqual(scheduler.cleared, [1, 2]);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.has("bot-b"), false);
  assert.equal(lifecycle.stop("bot-a"), false);
});
