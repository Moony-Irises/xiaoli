import assert from "node:assert/strict";
import test from "node:test";
import { InvalidatableTaskQueue } from "../src/runtime/invalidatable-task-queue.js";

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

test("invalidatable task queue runs tasks serially for the same key", async () => {
  const queue = new InvalidatableTaskQueue();
  const firstStarted = createDeferred();
  const releaseFirst = createDeferred();
  const calls: string[] = [];

  assert.equal(queue.enqueue("bot-a", async () => {
    calls.push("first:start");
    firstStarted.resolve();
    await releaseFirst.promise;
    calls.push("first:end");
  }), true);
  assert.equal(queue.enqueue("bot-a", async () => {
    calls.push("second");
  }), true);

  await firstStarted.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["first:start"]);

  releaseFirst.resolve();
  await queue.drain();
  assert.deepEqual(calls, ["first:start", "first:end", "second"]);
});

test("invalidate skips queued work without interrupting a running task", async () => {
  const queue = new InvalidatableTaskQueue();
  const firstStarted = createDeferred();
  const releaseFirst = createDeferred();
  const calls: string[] = [];
  const skipped: string[] = [];

  queue.enqueue("bot-a", async () => {
    calls.push("running:start");
    firstStarted.resolve();
    await releaseFirst.promise;
    calls.push("running:end");
  });
  queue.enqueue(
    "bot-a",
    async () => {
      calls.push("stale");
    },
    { onSkipped: () => skipped.push("stale") }
  );

  await firstStarted.promise;
  assert.equal(queue.invalidate("bot-a"), true);
  assert.equal(queue.invalidate("missing"), false);
  releaseFirst.resolve();
  await queue.drain();

  assert.deepEqual(calls, ["running:start", "running:end"]);
  assert.deepEqual(skipped, ["stale"]);
});

test("tasks enqueued after invalidation run in the new generation", async () => {
  const queue = new InvalidatableTaskQueue();
  const firstStarted = createDeferred();
  const releaseFirst = createDeferred();
  const calls: string[] = [];

  queue.enqueue("bot-a", async () => {
    calls.push("running");
    firstStarted.resolve();
    await releaseFirst.promise;
  });
  queue.enqueue("bot-a", async () => {
    calls.push("stale");
  });

  await firstStarted.promise;
  queue.invalidate("bot-a");
  queue.enqueue("bot-a", async () => {
    calls.push("fresh");
  });
  releaseFirst.resolve();
  await queue.drain();

  assert.deepEqual(calls, ["running", "fresh"]);
});

test("close rejects new work, skips queued work, and still drains running work", async () => {
  const queue = new InvalidatableTaskQueue();
  const firstStarted = createDeferred();
  const releaseFirst = createDeferred();
  const calls: string[] = [];
  const skipped: string[] = [];

  queue.enqueue("bot-a", async () => {
    calls.push("running:start");
    firstStarted.resolve();
    await releaseFirst.promise;
    calls.push("running:end");
  });
  queue.enqueue(
    "bot-a",
    async () => {
      calls.push("queued");
    },
    { onSkipped: () => skipped.push("queued") }
  );

  await firstStarted.promise;
  assert.equal(queue.close(), true);
  assert.equal(queue.close(), false);
  assert.equal(queue.enqueue(
    "bot-a",
    async () => {
      calls.push("late");
    },
    { onSkipped: () => skipped.push("late") }
  ), false);

  let drained = false;
  const draining = queue.drain().then(() => {
    drained = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(drained, false);

  releaseFirst.resolve();
  await draining;
  assert.deepEqual(calls, ["running:start", "running:end"]);
  assert.deepEqual(skipped, ["late", "queued"]);
});

test("task failures are reported and do not block later work", async () => {
  const errors: Array<{ key: string; error: unknown }> = [];
  const queue = new InvalidatableTaskQueue({
    onTaskError: (key, error) => errors.push({ key, error })
  });
  const failure = new Error("task failed");
  const calls: string[] = [];

  queue.enqueue("bot-a", async () => {
    throw failure;
  });
  queue.enqueue("bot-a", async () => {
    calls.push("after failure");
  });
  await queue.drain();

  assert.deepEqual(errors, [{ key: "bot-a", error: failure }]);
  assert.deepEqual(calls, ["after failure"]);
});

test("drain waits for work appended while an earlier task is running", async () => {
  const queue = new InvalidatableTaskQueue();
  const firstStarted = createDeferred();
  const releaseFirst = createDeferred();
  const secondStarted = createDeferred();
  const releaseSecond = createDeferred();

  queue.enqueue("bot-a", async () => {
    firstStarted.resolve();
    await releaseFirst.promise;
  });
  await firstStarted.promise;

  let drained = false;
  const draining = queue.drain().then(() => {
    drained = true;
  });
  queue.enqueue("bot-a", async () => {
    secondStarted.resolve();
    await releaseSecond.promise;
  });

  releaseFirst.resolve();
  await secondStarted.promise;
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(drained, false);

  releaseSecond.resolve();
  await draining;
  assert.equal(drained, true);
});
