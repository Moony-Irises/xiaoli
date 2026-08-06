import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  installProcessLifecycleHandlers,
  ProcessShutdownCoordinator,
  type ProcessLifecycleLogEntry
} from "../src/runtime/process-lifecycle.js";

function createLogger(entries: ProcessLifecycleLogEntry[]): (entry: ProcessLifecycleLogEntry) => void {
  return (entry) => entries.push(entry);
}

test("fatal process failures immediately lock the exit code and run shutdown once", async () => {
  let release: (() => void) | undefined;
  let shutdownCount = 0;
  const exitState: { exitCode?: number } = {};
  const logs: ProcessLifecycleLogEntry[] = [];
  const coordinator = new ProcessShutdownCoordinator({
    lifecycle: {
      run: () => {
        shutdownCount += 1;
        return new Promise<void>((resolve) => { release = resolve; });
      }
    },
    exitState,
    log: createLogger(logs)
  });

  const first = coordinator.handleFatal("uncaughtException", new Error("boom"));
  const second = coordinator.handleFatal("unhandledRejection", "again");

  assert.equal(exitState.exitCode, 1);
  assert.equal(first, second);
  assert.equal(shutdownCount, 1);

  release?.();
  await first;

  assert.equal(exitState.exitCode, 1);
  assert.equal(logs.filter((entry) => entry.message === "Fatal process failure").length, 2);
  assert.equal(logs.filter((entry) => entry.message === "Runtime shutdown completed").length, 1);
});

test("a fatal error during signal shutdown cannot be reset to a success exit code", async () => {
  let release: (() => void) | undefined;
  let shutdownCount = 0;
  const exitState: { exitCode?: number } = {};
  const coordinator = new ProcessShutdownCoordinator({
    lifecycle: {
      run: () => {
        shutdownCount += 1;
        return new Promise<void>((resolve) => { release = resolve; });
      }
    },
    exitState,
    log: () => undefined
  });

  const signalShutdown = coordinator.handleSignal("SIGINT");
  const fatalShutdown = coordinator.handleFatal("startup", new Error("late failure"));
  assert.equal(exitState.exitCode, 1);
  assert.equal(signalShutdown, fatalShutdown);

  release?.();
  await signalShutdown;

  assert.equal(shutdownCount, 1);
  assert.equal(exitState.exitCode, 1);
});

test("clean signal shutdown exits successfully", async () => {
  const exitState: { exitCode?: number } = {};
  const logs: ProcessLifecycleLogEntry[] = [];
  const coordinator = new ProcessShutdownCoordinator({
    lifecycle: { run: async () => undefined },
    exitState,
    log: createLogger(logs)
  });

  await coordinator.handleSignal("SIGTERM");

  assert.equal(exitState.exitCode, 0);
  assert.equal(logs[0]?.message, "Shutdown signal received");
  assert.equal(logs.at(-1)?.message, "Runtime shutdown completed");
});

test("shutdown failures are contained and retain a failure exit code", async () => {
  const exitState: { exitCode?: number } = {};
  const logs: ProcessLifecycleLogEntry[] = [];
  const coordinator = new ProcessShutdownCoordinator({
    lifecycle: { run: async () => { throw new Error("flush failed"); } },
    exitState,
    log: createLogger(logs)
  });

  await coordinator.handleFatal("unhandledRejection", new Error("request failed"));

  assert.equal(exitState.exitCode, 1);
  assert.equal(logs.at(-1)?.message, "Runtime shutdown completed with errors");
  assert.match(String(logs.at(-1)?.context.error), /flush failed/);
});

test("process event handlers route failures and can be removed", async () => {
  const events = new EventEmitter();
  const exitState: { exitCode?: number } = {};
  let shutdownCount = 0;
  const coordinator = new ProcessShutdownCoordinator({
    lifecycle: {
      run: async () => { shutdownCount += 1; }
    },
    exitState,
    log: () => undefined
  });
  const dispose = installProcessLifecycleHandlers(coordinator, events);

  events.emit("unhandledRejection", new Error("async failure"));
  await coordinator.waitForShutdown();

  assert.equal(shutdownCount, 1);
  assert.equal(exitState.exitCode, 1);

  dispose();
  assert.equal(events.listenerCount("SIGINT"), 0);
  assert.equal(events.listenerCount("SIGTERM"), 0);
  assert.equal(events.listenerCount("unhandledRejection"), 0);
  assert.equal(events.listenerCount("uncaughtException"), 0);
});
