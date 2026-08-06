import assert from "node:assert/strict";
import test from "node:test";
import { drainPromiseQueue } from "../src/runtime/promise-queue.js";

test("drainPromiseQueue waits for the current queue", async () => {
  let release: (() => void) | undefined;
  let completed = false;
  const queue = new Promise<void>((resolve) => {
    release = resolve;
  }).then(() => {
    completed = true;
  });

  const draining = drainPromiseQueue(() => queue);
  assert.equal(completed, false);
  release?.();
  await draining;

  assert.equal(completed, true);
});

test("drainPromiseQueue also waits for work appended while draining", async () => {
  let releaseFirst: (() => void) | undefined;
  let releaseSecond: (() => void) | undefined;
  const completed: string[] = [];
  let queue = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  }).then(() => {
    completed.push("first");
  });

  const draining = drainPromiseQueue(() => queue);
  queue = queue.then(() => new Promise<void>((resolve) => {
    releaseSecond = resolve;
  })).then(() => {
    completed.push("second");
  });

  releaseFirst?.();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(completed, ["first"]);

  releaseSecond?.();
  await draining;
  assert.deepEqual(completed, ["first", "second"]);
});

test("drainPromiseQueue propagates queue failures", async () => {
  const failure = new Error("queue failed");
  const queue = Promise.reject(failure);

  await assert.rejects(drainPromiseQueue(() => queue), failure);
});
