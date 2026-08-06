import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { CommandDispatcher } from "../src/commands/command-dispatcher.js";

function createClock(...timestamps: string[]): () => Date {
  let index = 0;
  return () => {
    const value = timestamps[index];
    index += 1;
    if (!value) throw new Error("Test clock exhausted");
    return new Date(value);
  };
}

test("CommandDispatcher validates input and records a successful invocation", async () => {
  const dispatcher = new CommandDispatcher({
    createRequestId: () => "request-1",
    now: createClock("2026-07-31T08:00:00.000Z", "2026-07-31T08:00:00.025Z")
  });
  const calls: Array<{ message: string; source: string }> = [];

  dispatcher.register({
    id: "test.echo",
    inputSchema: z.object({ message: z.string().min(1) }),
    execute(input, context) {
      calls.push({ message: input.message, source: context.source });
      return {
        echoed: input.message,
        metadata: { source: context.source }
      };
    }
  });

  const result = await dispatcher.invoke({
    commandId: "test.echo",
    input: { message: "hello" },
    context: {
      source: "web",
      botId: "bot-1",
      requester: "Judy"
    }
  });

  assert.deepEqual(calls, [{ message: "hello", source: "web" }]);
  assert.deepEqual(result, {
    requestId: "request-1",
    commandId: "test.echo",
    source: "web",
    botId: "bot-1",
    requester: "Judy",
    status: "executed",
    startedAt: "2026-07-31T08:00:00.000Z",
    completedAt: "2026-07-31T08:00:00.025Z",
    durationMs: 25,
    output: {
      echoed: "hello",
      metadata: { source: "web" }
    }
  });
  const firstHistoryRead = dispatcher.getHistory();
  const secondHistoryRead = dispatcher.getHistory();
  assert.deepEqual(firstHistoryRead, [result]);
  assert.notEqual(firstHistoryRead[0], result);
  assert.notEqual(firstHistoryRead[0]?.output, result.output);
  assert.notEqual(firstHistoryRead[0]?.output?.metadata, result.output?.metadata);
  assert.notEqual(firstHistoryRead[0]?.output?.metadata, secondHistoryRead[0]?.output?.metadata);
});

test("CommandDispatcher rejects invalid input before executing the handler", async () => {
  const dispatcher = new CommandDispatcher({
    createRequestId: () => "invalid-request",
    now: createClock("2026-07-31T08:01:00.000Z", "2026-07-31T08:01:00.000Z")
  });
  let callCount = 0;
  dispatcher.register({
    id: "test.echo",
    inputSchema: z.object({ message: z.string().min(1) }),
    execute() {
      callCount += 1;
      return {};
    }
  });

  const result = await dispatcher.invoke({
    commandId: "test.echo",
    input: { message: "" },
    context: { source: "mcp", botId: "bot-1" }
  });

  assert.equal(callCount, 0);
  assert.equal(result.status, "failed");
  assert.equal(result.error?.code, "invalid_input");
  assert.match(result.error?.message ?? "", /message/i);
  assert.equal(result.output, undefined);
});

test("CommandDispatcher converts handler errors into execution failures", async () => {
  const dispatcher = new CommandDispatcher({
    createRequestId: () => "failed-request",
    now: createClock("2026-07-31T08:02:00.000Z", "2026-07-31T08:02:00.010Z")
  });
  dispatcher.register({
    id: "test.fail",
    inputSchema: z.object({}),
    execute() {
      throw new Error("movement unavailable");
    }
  });

  const result = await dispatcher.invoke({
    commandId: "test.fail",
    input: {},
    context: { source: "agent", botId: "bot-1" }
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.error, {
    code: "execution_failed",
    message: "movement unavailable"
  });
  assert.equal(result.durationMs, 10);
});

test("CommandDispatcher redacts secrets only in stored history", async () => {
  const dispatcher = new CommandDispatcher({
    createRequestId: () => "secret-request",
    now: createClock("2026-07-31T08:02:30.000Z", "2026-07-31T08:02:30.001Z")
  });
  dispatcher.register({
    id: "test.secret-failure",
    inputSchema: z.object({}),
    execute() {
      throw new Error(
        'request failed: password=redaction-password-fixture, "accessToken":"redaction-token-fixture", Bearer redaction-bearer-fixture'
      );
    }
  });

  const result = await dispatcher.invoke({
    commandId: "test.secret-failure",
    input: {},
    context: { source: "internal", botId: "bot-1" }
  });

  assert.match(result.error?.message ?? "", /redaction-password-fixture/);
  assert.match(result.error?.message ?? "", /redaction-token-fixture/);
  assert.match(result.error?.message ?? "", /redaction-bearer-fixture/);

  const storedMessage = dispatcher.getHistory()[0]?.error?.message ?? "";
  assert.doesNotMatch(
    storedMessage,
    /redaction-password-fixture|redaction-token-fixture|redaction-bearer-fixture/
  );
  assert.match(storedMessage, /password=\[redacted\]/);
  assert.match(storedMessage, /"accessToken":"\[redacted\]"/);
  assert.match(storedMessage, /Bearer \[redacted\]/);
});

test("CommandDispatcher recursively redacts sensitive output keys in history", async () => {
  const dispatcher = new CommandDispatcher({
    createRequestId: () => "secret-output-request",
    now: createClock("2026-07-31T08:02:45.000Z", "2026-07-31T08:02:45.001Z")
  });
  dispatcher.register({
    id: "test.secret-output",
    inputSchema: z.object({}),
    execute() {
      return {
        nested: {
          apiKey: "redaction-fixture-value",
          label: "safe"
        }
      };
    }
  });

  const result = await dispatcher.invoke({
    commandId: "test.secret-output",
    input: {},
    context: { source: "internal", botId: "bot-1" }
  });

  assert.deepEqual(result.output, {
    nested: {
      apiKey: "redaction-fixture-value",
      label: "safe"
    }
  });
  assert.deepEqual(dispatcher.getHistory()[0]?.output, {
    nested: {
      apiKey: "[redacted]",
      label: "safe"
    }
  });
});

test("CommandDispatcher reports unknown commands without executing a handler", async () => {
  const dispatcher = new CommandDispatcher({
    createRequestId: () => "missing-request",
    now: createClock("2026-07-31T08:03:00.000Z", "2026-07-31T08:03:00.000Z")
  });

  const result = await dispatcher.invoke({
    commandId: "missing.command",
    input: {},
    context: { source: "internal", botId: "bot-1" }
  });

  assert.equal(result.status, "failed");
  assert.deepEqual(result.error, {
    code: "command_not_found",
    message: "Command 'missing.command' is not registered"
  });
  assert.deepEqual(dispatcher.getHistory(), [result]);
});

test("CommandDispatcher rejects duplicate command registrations", () => {
  const dispatcher = new CommandDispatcher();
  const definition = {
    id: "test.echo",
    inputSchema: z.object({}),
    execute: () => ({})
  };

  dispatcher.register(definition);
  assert.throws(
    () => dispatcher.register(definition),
    /Command 'test\.echo' is already registered/
  );
});

test("CommandDispatcher keeps bounded newest-first history with filters", async () => {
  let requestId = 0;
  const timestamps = [
    "2026-07-31T08:04:00.000Z",
    "2026-07-31T08:04:00.001Z",
    "2026-07-31T08:04:01.000Z",
    "2026-07-31T08:04:01.001Z",
    "2026-07-31T08:04:02.000Z",
    "2026-07-31T08:04:02.001Z"
  ];
  const dispatcher = new CommandDispatcher({
    maxHistory: 2,
    createRequestId: () => `request-${++requestId}`,
    now: createClock(...timestamps)
  });
  dispatcher.register({
    id: "test.noop",
    inputSchema: z.object({}),
    execute: () => ({ done: true })
  });

  await dispatcher.invoke({
    commandId: "test.noop",
    input: {},
    context: { source: "agent", botId: "bot-1" }
  });
  await dispatcher.invoke({
    commandId: "test.noop",
    input: {},
    context: { source: "web", botId: "bot-2" }
  });
  await dispatcher.invoke({
    commandId: "test.noop",
    input: {},
    context: { source: "mcp", botId: "bot-1" }
  });

  assert.deepEqual(
    dispatcher.getHistory().map((entry) => entry.requestId),
    ["request-3", "request-2"]
  );
  assert.deepEqual(
    dispatcher.getHistory({ botId: "bot-1" }).map((entry) => entry.requestId),
    ["request-3"]
  );
  assert.deepEqual(
    dispatcher.getHistory({ source: "web", limit: 1 }).map((entry) => entry.requestId),
    ["request-2"]
  );
});
