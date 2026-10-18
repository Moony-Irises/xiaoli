import assert from "node:assert/strict";
import test from "node:test";
import { MiningTaskQueue } from "../src/runtime/mining-task-queue.js";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: (value) => resolvePromise?.(value)
  };
}

function waitForTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

test("mining task queue serializes work for the same bot", async () => {
  const queue = new MiningTaskQueue();
  const firstStarted = createDeferred<void>();
  const releaseFirst = createDeferred<void>();
  const calls: string[] = [];

  const first = queue.enqueue("bot-a", async () => {
    calls.push("first:start");
    firstStarted.resolve();
    await releaseFirst.promise;
    calls.push("first:end");
    return "first-result";
  });
  const second = queue.enqueue("bot-a", async () => {
    calls.push("second");
    return "second-result";
  });

  await firstStarted.promise;
  await waitForTurn();
  assert.deepEqual(calls, ["first:start"]);

  releaseFirst.resolve();
  assert.equal(await first, "first-result");
  assert.equal(await second, "second-result");
  assert.deepEqual(calls, ["first:start", "first:end", "second"]);
});

test("mining task queue lets different bots run independently", async () => {
  const queue = new MiningTaskQueue();
  const firstStarted = createDeferred<void>();
  const releaseFirst = createDeferred<void>();
  const secondStarted = createDeferred<void>();

  const first = queue.enqueue("bot-a", async () => {
    firstStarted.resolve();
    await releaseFirst.promise;
    return "bot-a";
  });
  const second = queue.enqueue("bot-b", async () => {
    secondStarted.resolve();
    return "bot-b";
  });

  await Promise.all([firstStarted.promise, secondStarted.promise]);
  assert.equal(await second, "bot-b");
  releaseFirst.resolve();
  assert.equal(await first, "bot-a");
});

test("mining task queue returns task values without copying them", async () => {
  const queue = new MiningTaskQueue();
  const result = { mined: 3 };

  assert.equal(await queue.enqueue("bot-a", async () => result), result);
});

test("mining task queue propagates failures and continues later work", async () => {
  const queue = new MiningTaskQueue();
  const failure = new Error("mining failed");
  const failed = queue.enqueue("bot-a", async () => {
    throw failure;
  });
  const recovered = queue.enqueue("bot-a", async () => "recovered");

  await assert.rejects(failed, failure);
  assert.equal(await recovered, "recovered");
  await assert.doesNotReject(Promise.all(queue.getTrackedTasks()));
});

test("mining task queue exposes a shutdown snapshot instead of dynamic drain", async () => {
  const queue = new MiningTaskQueue();
  const firstStarted = createDeferred<void>();
  const releaseFirst = createDeferred<void>();
  const secondStarted = createDeferred<void>();
  const releaseSecond = createDeferred<void>();

  const first = queue.enqueue("bot-a", async () => {
    firstStarted.resolve();
    await releaseFirst.promise;
  });
  await firstStarted.promise;
  const shutdownSnapshot = queue.getTrackedTasks();
  assert.equal(shutdownSnapshot.length, 1);

  const second = queue.enqueue("bot-a", async () => {
    secondStarted.resolve();
    await releaseSecond.promise;
  });
  releaseFirst.resolve();
  await first;
  await Promise.all(shutdownSnapshot);
  await secondStarted.promise;

  let secondSettled = false;
  void second.then(() => {
    secondSettled = true;
  });
  await waitForTurn();
  assert.equal(secondSettled, false);

  releaseSecond.resolve();
  await second;
  assert.equal(queue.getTrackedTasks().length, 1);
  await assert.doesNotReject(Promise.all(queue.getTrackedTasks()));
});
