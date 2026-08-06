import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import {
  closeHttpServer,
  RuntimeShutdownLifecycle
} from "../src/runtime/shutdown-lifecycle.js";

test("RuntimeShutdownLifecycle runs shutdown stages in order", async () => {
  const calls: string[] = [];
  const lifecycle = new RuntimeShutdownLifecycle({
    closeDebugServer: async () => { calls.push("debug"); },
    stopActionRuntime: async () => { calls.push("runtime"); },
    disconnectBots: async () => { calls.push("bots"); },
    flushPersistence: async () => { calls.push("flush"); },
    closeMcpServer: async () => { calls.push("mcp"); }
  });

  await lifecycle.run();

  assert.deepEqual(calls, ["debug", "runtime", "bots", "flush", "mcp"]);
});

test("RuntimeShutdownLifecycle returns the same promise for repeated shutdown requests", async () => {
  let release: (() => void) | undefined;
  let closeDebugCount = 0;
  const lifecycle = new RuntimeShutdownLifecycle({
    closeDebugServer: () => {
      closeDebugCount += 1;
      return new Promise<void>((resolve) => { release = resolve; });
    },
    stopActionRuntime: async () => undefined,
    disconnectBots: async () => undefined,
    flushPersistence: async () => undefined,
    closeMcpServer: async () => undefined
  });

  const first = lifecycle.run();
  const second = lifecycle.run();
  assert.equal(first, second);
  assert.equal(closeDebugCount, 1);

  release?.();
  await first;
  assert.equal(closeDebugCount, 1);
});

test("RuntimeShutdownLifecycle stops actions while the debug server is still draining", async () => {
  let releaseDebug: (() => void) | undefined;
  const calls: string[] = [];
  const lifecycle = new RuntimeShutdownLifecycle({
    closeDebugServer: () => {
      calls.push("debug");
      return new Promise<void>((resolve) => { releaseDebug = resolve; });
    },
    stopActionRuntime: async () => { calls.push("runtime"); },
    disconnectBots: async () => { calls.push("bots"); },
    flushPersistence: async () => { calls.push("flush"); },
    closeMcpServer: async () => { calls.push("mcp"); }
  });

  const shutdown = lifecycle.run();
  await Promise.resolve();

  assert.deepEqual(calls, ["debug", "runtime"]);

  releaseDebug?.();
  await shutdown;
  assert.deepEqual(calls, ["debug", "runtime", "bots", "flush", "mcp"]);
});

test("RuntimeShutdownLifecycle continues after failures and aggregates them", async () => {
  const calls: string[] = [];
  const lifecycle = new RuntimeShutdownLifecycle({
    closeDebugServer: async () => {
      calls.push("debug");
      throw new Error("debug failed");
    },
    stopActionRuntime: async () => { calls.push("runtime"); },
    disconnectBots: async () => { calls.push("bots"); },
    flushPersistence: async () => {
      calls.push("flush");
      throw new Error("flush failed");
    },
    closeMcpServer: async () => { calls.push("mcp"); }
  });

  await assert.rejects(lifecycle.run(), (error: unknown) => {
    assert.ok(error instanceof AggregateError);
    assert.deepEqual(error.errors.map((entry) => (entry as Error).message), [
      "closeDebugServer: debug failed",
      "flushPersistence: flush failed"
    ]);
    return true;
  });
  assert.deepEqual(calls, ["debug", "runtime", "bots", "flush", "mcp"]);
});

test("closeHttpServer closes a listening server and accepts an absent server", async () => {
  await closeHttpServer(null);

  const server = http.createServer((_request, response) => response.end("ok"));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  assert.equal(server.listening, true);

  await closeHttpServer(server);
  assert.equal(server.listening, false);
});
