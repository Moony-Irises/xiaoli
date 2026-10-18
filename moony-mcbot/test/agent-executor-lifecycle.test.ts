import assert from "node:assert/strict";
import test from "node:test";
import { AgentExecutorLifecycle } from "../src/runtime/agent-executor-lifecycle.js";
import type { IntervalScheduler } from "../src/runtime/interval-scheduler.js";

interface FakeIntervalHandle {
  id: number;
  active: boolean;
  callback: () => void;
  delayMs: number;
}

class FakeIntervalScheduler implements IntervalScheduler<FakeIntervalHandle> {
  private nextId = 1;
  readonly events: string[] = [];
  readonly handles: FakeIntervalHandle[] = [];

  setInterval(callback: () => void, delayMs: number): FakeIntervalHandle {
    const handle = {
      id: this.nextId,
      active: true,
      callback,
      delayMs
    };
    this.nextId += 1;
    this.handles.push(handle);
    this.events.push(`set:${handle.id}:${delayMs}`);
    return handle;
  }

  clearInterval(handle: FakeIntervalHandle): void {
    this.events.push(`clear:${handle.id}`);
    handle.active = false;
  }

  fire(handle: FakeIntervalHandle): void {
    if (handle.active) handle.callback();
  }

  get activeHandles(): FakeIntervalHandle[] {
    return this.handles.filter((handle) => handle.active);
  }
}

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
}

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => resolvePromise?.()
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("agent executor lifecycle starts a tracked loop with the requested delay", async () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new AgentExecutorLifecycle(scheduler);
  const calls: string[] = [];

  lifecycle.start("bot-a", 2400, async () => {
    calls.push("tick");
  });

  assert.equal(lifecycle.isAttached("bot-a"), true);
  assert.equal(scheduler.activeHandles.length, 1);
  assert.equal(scheduler.activeHandles[0]?.delayMs, 2400);

  scheduler.fire(scheduler.activeHandles[0]!);
  await Promise.all(lifecycle.getTrackedRuns());
  assert.deepEqual(calls, ["tick"]);
});

test("agent executor lifecycle replaces an existing loop before starting the next", () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new AgentExecutorLifecycle(scheduler);

  lifecycle.start("bot-a", 1500, async () => undefined);
  lifecycle.start("bot-a", 3000, async () => undefined);

  assert.deepEqual(scheduler.events, ["set:1:1500", "clear:1", "set:2:3000"]);
  assert.equal(scheduler.handles[0]?.active, false);
  assert.equal(scheduler.handles[1]?.active, true);
  assert.equal(lifecycle.isAttached("bot-a"), true);
});

test("agent executor lifecycle serializes runs for the same bot", async () => {
  const lifecycle = new AgentExecutorLifecycle(new FakeIntervalScheduler());
  const firstGate = createDeferred();
  const calls: string[] = [];

  lifecycle.enqueue("bot-a", async () => {
    calls.push("first:start");
    await firstGate.promise;
    calls.push("first:end");
  });
  lifecycle.enqueue("bot-a", async () => {
    calls.push("second");
  });

  await flushMicrotasks();
  assert.deepEqual(calls, ["first:start"]);

  firstGate.resolve();
  await Promise.all(lifecycle.getTrackedRuns());
  assert.deepEqual(calls, ["first:start", "first:end", "second"]);
});

test("agent executor lifecycle allows different bots to run independently", async () => {
  const lifecycle = new AgentExecutorLifecycle(new FakeIntervalScheduler());
  const botAGate = createDeferred();
  const calls: string[] = [];

  lifecycle.enqueue("bot-a", async () => {
    calls.push("bot-a:start");
    await botAGate.promise;
    calls.push("bot-a:end");
  });
  lifecycle.enqueue("bot-b", async () => {
    calls.push("bot-b");
  });

  await flushMicrotasks();
  assert.deepEqual(calls, ["bot-a:start", "bot-b"]);

  botAGate.resolve();
  await Promise.all(lifecycle.getTrackedRuns());
  assert.deepEqual(calls, ["bot-a:start", "bot-b", "bot-a:end"]);
});

test("agent executor lifecycle isolates a failed run from the next run", async () => {
  const lifecycle = new AgentExecutorLifecycle(new FakeIntervalScheduler());
  const calls: string[] = [];

  lifecycle.enqueue("bot-a", async () => {
    calls.push("failed");
    throw new Error("tick failed");
  });
  lifecycle.enqueue("bot-a", async () => {
    calls.push("recovered");
  });

  await Promise.all(lifecycle.getTrackedRuns());
  assert.deepEqual(calls, ["failed", "recovered"]);
});

test("stopping an executor loop leaves its current run available for flush", async () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new AgentExecutorLifecycle(scheduler);
  const gate = createDeferred();
  let completed = false;

  lifecycle.start("bot-a", 1500, async () => {
    await gate.promise;
    completed = true;
  });
  scheduler.fire(scheduler.activeHandles[0]!);
  await flushMicrotasks();

  assert.equal(lifecycle.stop("bot-a"), true);
  assert.equal(lifecycle.isAttached("bot-a"), false);
  assert.equal(lifecycle.getTrackedRuns().length, 1);
  assert.equal(completed, false);

  gate.resolve();
  await Promise.all(lifecycle.getTrackedRuns());
  assert.equal(completed, true);
  assert.equal(lifecycle.stop("bot-a"), false);
});

test("forgetting a tracked run does not cancel it and resets later serialization", async () => {
  const lifecycle = new AgentExecutorLifecycle(new FakeIntervalScheduler());
  const gate = createDeferred();
  const calls: string[] = [];

  lifecycle.enqueue("bot-a", async () => {
    calls.push("old:start");
    await gate.promise;
    calls.push("old:end");
  });
  await flushMicrotasks();

  assert.equal(lifecycle.forgetRun("bot-a"), true);
  assert.deepEqual(lifecycle.getTrackedRuns(), []);
  lifecycle.enqueue("bot-a", async () => {
    calls.push("new");
  });
  await Promise.all(lifecycle.getTrackedRuns());
  assert.deepEqual(calls, ["old:start", "new"]);

  gate.resolve();
  await flushMicrotasks();
  assert.deepEqual(calls, ["old:start", "new", "old:end"]);
  assert.equal(lifecycle.forgetRun("bot-a"), true);
  assert.equal(lifecycle.forgetRun("bot-a"), false);
});

test("shutdown stops all loops while retaining runs for persistence flush", async () => {
  const scheduler = new FakeIntervalScheduler();
  const lifecycle = new AgentExecutorLifecycle(scheduler);
  const gate = createDeferred();

  lifecycle.start("bot-a", 1500, async () => {
    await gate.promise;
  });
  lifecycle.start("bot-b", 3000, async () => undefined);
  scheduler.fire(scheduler.handles[0]!);
  await flushMicrotasks();

  lifecycle.stopLoopsForShutdown();
  assert.deepEqual(scheduler.activeHandles, []);
  assert.equal(lifecycle.isAttached("bot-a"), false);
  assert.equal(lifecycle.isAttached("bot-b"), false);
  assert.equal(lifecycle.getTrackedRuns().length, 1);

  gate.resolve();
  await Promise.all(lifecycle.getTrackedRuns());
});
