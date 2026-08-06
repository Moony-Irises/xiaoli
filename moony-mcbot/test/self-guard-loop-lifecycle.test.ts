import assert from "node:assert/strict";
import test from "node:test";
import {
  SelfGuardLoopLifecycle,
  type IntervalScheduler
} from "../src/runtime/self-guard-loop-lifecycle.js";

interface FakeIntervalHandle {
  id: number;
  callback: () => void;
  delayMs: number;
  active: boolean;
}

class FakeIntervalScheduler implements IntervalScheduler<FakeIntervalHandle> {
  private nextId = 1;
  readonly handles: FakeIntervalHandle[] = [];

  setInterval(callback: () => void, delayMs: number): FakeIntervalHandle {
    const handle = {
      id: this.nextId,
      callback,
      delayMs,
      active: true
    };
    this.nextId += 1;
    this.handles.push(handle);
    return handle;
  }

  clearInterval(handle: FakeIntervalHandle): void {
    handle.active = false;
  }

  run(handle: FakeIntervalHandle): void {
    if (handle.active) handle.callback();
  }

  get activeHandles(): FakeIntervalHandle[] {
    return this.handles.filter((handle) => handle.active);
  }
}

test("self-guard loop lifecycle starts and reports a bot loop", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);
  let calls = 0;

  lifecycle.start("bot-a", 2000, () => {
    calls += 1;
  });

  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(scheduler.activeHandles.length, 1);
  assert.equal(scheduler.activeHandles[0]?.delayMs, 2000);
  scheduler.run(scheduler.activeHandles[0]!);
  assert.equal(calls, 1);
});

test("self-guard loop lifecycle replaces an existing bot interval", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);
  const calls: string[] = [];

  lifecycle.start("bot-a", 1000, () => calls.push("old"));
  const oldHandle = scheduler.activeHandles[0]!;
  lifecycle.start("bot-a", 2500, () => calls.push("current"));
  const currentHandle = scheduler.activeHandles[0]!;

  assert.equal(oldHandle.active, false);
  assert.notEqual(currentHandle, oldHandle);
  assert.equal(currentHandle.delayMs, 2500);
  scheduler.run(oldHandle);
  scheduler.run(currentHandle);
  assert.deepEqual(calls, ["current"]);
});

test("self-guard loop lifecycle stops bot intervals idempotently", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);
  lifecycle.start("bot-a", 1000, () => {});

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.equal(lifecycle.stop("bot-a"), false);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.deepEqual(scheduler.activeHandles, []);
});

test("self-guard loop lifecycle owns a single watchdog", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);
  let calls = 0;

  assert.equal(lifecycle.ensureWatchdog(1500, () => {
    calls += 1;
  }), true);
  assert.equal(lifecycle.ensureWatchdog(500, () => {
    calls += 100;
  }), false);
  assert.equal(lifecycle.isWatchdogRunning(), true);
  assert.equal(scheduler.activeHandles.length, 1);

  scheduler.run(scheduler.activeHandles[0]!);
  assert.equal(calls, 1);
  assert.equal(lifecycle.stopWatchdog(), true);
  assert.equal(lifecycle.stopWatchdog(), false);
  assert.equal(lifecycle.isWatchdogRunning(), false);
});

test("self-guard loop lifecycle owns one retaliation interval per bot", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);
  let calls = 0;

  assert.equal(lifecycle.ensureRetaliation("bot-a", 250, () => {
    calls += 1;
  }), true);
  assert.equal(lifecycle.ensureRetaliation("bot-a", 500, () => {
    calls += 100;
  }), false);
  assert.equal(lifecycle.hasRetaliation("bot-a"), true);
  assert.equal(scheduler.activeHandles.length, 1);
  assert.equal(scheduler.activeHandles[0]?.delayMs, 250);

  scheduler.run(scheduler.activeHandles[0]!);
  assert.equal(calls, 1);
  assert.equal(lifecycle.stopRetaliation("bot-a"), true);
  assert.equal(lifecycle.stopRetaliation("bot-a"), false);
  assert.equal(lifecycle.hasRetaliation("bot-a"), false);
});

test("self-guard loop lifecycle stops every interval and watchdog", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);
  lifecycle.start("bot-a", 1000, () => {});
  lifecycle.start("bot-b", 2000, () => {});
  lifecycle.ensureRetaliation("bot-a", 250, () => {});
  lifecycle.ensureRetaliation("bot-b", 250, () => {});
  lifecycle.ensureWatchdog(1500, () => {});

  lifecycle.stopAll();

  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.has("bot-b"), false);
  assert.equal(lifecycle.hasRetaliation("bot-a"), false);
  assert.equal(lifecycle.hasRetaliation("bot-b"), false);
  assert.equal(lifecycle.isWatchdogRunning(), false);
  assert.deepEqual(scheduler.activeHandles, []);
});

test("self-guard loop lifecycle rejects invalid interval durations", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new SelfGuardLoopLifecycle(scheduler);

  assert.throws(() => lifecycle.start("bot-a", 0, () => {}), RangeError);
  assert.throws(() => lifecycle.start("bot-a", Number.NaN, () => {}), RangeError);
  assert.throws(() => lifecycle.ensureWatchdog(-1, () => {}), RangeError);
  assert.throws(() => lifecycle.ensureRetaliation("bot-a", Number.POSITIVE_INFINITY, () => {}), RangeError);
  assert.deepEqual(scheduler.handles, []);
});
