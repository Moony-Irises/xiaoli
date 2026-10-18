import assert from "node:assert/strict";
import test from "node:test";
import {
  ChatListenerLifecycle,
  type ChatListenerShutdownCleanup
} from "../src/runtime/chat-listener-lifecycle.js";
import type { IntervalScheduler } from "../src/runtime/interval-scheduler.js";

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

test("chat listener lifecycle tracks subscriptions by bot and runtime reference", () => {
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(
    new FakeIntervalScheduler()
  );
  const firstRuntime = {};
  const secondRuntime = {};

  lifecycle.activate("bot-a", firstRuntime, () => {});
  lifecycle.activate("bot-b", secondRuntime, () => {});

  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), true);
  assert.equal(lifecycle.isCurrent("bot-a", firstRuntime), true);
  assert.equal(lifecycle.isCurrent("bot-a", secondRuntime), false);
  assert.equal(lifecycle.isCurrent("missing", firstRuntime), false);
});

test("chat listener lifecycle unsubscribes before deleting the binding", () => {
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(
    new FakeIntervalScheduler()
  );
  const observations: boolean[] = [];

  lifecycle.activate("bot-a", {}, () => {
    observations.push(lifecycle.has("bot-a"));
  });

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.deepEqual(observations, [true]);
  assert.equal(lifecycle.has("bot-a"), false);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("chat listener lifecycle retains a binding when unsubscribe fails", () => {
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(
    new FakeIntervalScheduler()
  );
  const failure = new Error("unsubscribe failed");
  lifecycle.activate("bot-a", {}, () => {
    throw failure;
  });

  assert.throws(() => lifecycle.stop("bot-a"), failure);
  assert.equal(lifecycle.has("bot-a"), true);
});

test("chat listener lifecycle leaves explicit replacement cleanup to the caller", () => {
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(
    new FakeIntervalScheduler()
  );
  let oldUnsubscribeCount = 0;
  const currentRuntime = {};

  lifecycle.activate("bot-a", {}, () => {
    oldUnsubscribeCount += 1;
  });
  lifecycle.activate("bot-a", currentRuntime, () => {});

  assert.equal(oldUnsubscribeCount, 0);
  assert.equal(lifecycle.isCurrent("bot-a", currentRuntime), true);
});

test("chat listener lifecycle owns a single watchdog interval", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(scheduler);
  let calls = 0;

  assert.equal(lifecycle.ensureWatchdog(1500, () => {
    calls += 1;
  }), true);
  assert.equal(lifecycle.ensureWatchdog(500, () => {
    calls += 100;
  }), false);
  assert.equal(lifecycle.isWatchdogRunning(), true);
  assert.equal(scheduler.activeHandles.length, 1);
  assert.equal(scheduler.activeHandles[0]?.delayMs, 1500);

  scheduler.run(scheduler.activeHandles[0]!);
  assert.equal(calls, 1);
  assert.equal(lifecycle.stopWatchdog(), true);
  assert.equal(lifecycle.stopWatchdog(), false);
  assert.equal(lifecycle.isWatchdogRunning(), false);
  assert.deepEqual(scheduler.activeHandles, []);
});

test("chat listener lifecycle isolates shutdown cleanup failures through the caller", () => {
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(
    new FakeIntervalScheduler()
  );
  const failure = new Error("bot-a failed");
  const failures: Array<{ botId: string; error: unknown }> = [];
  const stopped: string[] = [];
  lifecycle.activate("bot-a", {}, () => {
    throw failure;
  });
  lifecycle.activate("bot-b", {}, () => {
    stopped.push("bot-b");
  });

  const cleanup: ChatListenerShutdownCleanup = (botId, stop) => {
    try {
      stop();
    } catch (error) {
      failures.push({ botId, error });
    }
  };
  lifecycle.stopSubscriptionsForShutdown(cleanup);

  assert.deepEqual(failures, [{ botId: "bot-a", error: failure }]);
  assert.deepEqual(stopped, ["bot-b"]);
  assert.equal(lifecycle.has("bot-a"), true);
  assert.equal(lifecycle.has("bot-b"), false);
});

test("chat listener lifecycle rejects invalid watchdog intervals before scheduling", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new ChatListenerLifecycle<FakeIntervalHandle, object>(scheduler);

  assert.throws(() => lifecycle.ensureWatchdog(0, () => {}), RangeError);
  assert.throws(() => lifecycle.ensureWatchdog(Number.NaN, () => {}), RangeError);
  assert.throws(
    () => lifecycle.ensureWatchdog(Number.POSITIVE_INFINITY, () => {}),
    RangeError
  );
  assert.deepEqual(scheduler.handles, []);
});
