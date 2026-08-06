import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { BotRuntime } from "../src/runtime/bot-runtime.js";
import { ClientAdapter } from "../src/runtime/client-adapter.js";
import { AuthSession, RuntimeState, RuntimeStatus } from "../src/types.js";

interface RuntimeInternals {
  adapter: ClientAdapter;
  authService: {
    authenticate: (...args: unknown[]) => Promise<AuthSession>;
  };
  scheduleAutoReconnect: (trigger: string) => void;
  state: RuntimeState;
}

function createRuntime(options: Record<string, unknown> = {}): BotRuntime {
  return new BotRuntime("connection-generation-test", {
    botId: "connection-generation-test",
    authApiBaseUrl: "http://127.0.0.1:3000",
    username: "test-user",
    password: "not-used",
    serverHost: "127.0.0.1",
    autoReconnect: false,
    connectMaxRetries: 0,
    ...options
  });
}

const testSession: AuthSession = {
  accessToken: "access-token",
  clientToken: "client-token",
  selectedProfile: {
    id: "profile-id",
    name: "TestBot"
  }
};

test("manual disconnect cancels an in-flight authentication attempt", async () => {
  const runtime = createRuntime();
  const internals = runtime as unknown as RuntimeInternals;
  let releaseAuthentication: (() => void) | undefined;
  let authenticationStartedResolve: (() => void) | undefined;
  const authenticationStarted = new Promise<void>((resolve) => {
    authenticationStartedResolve = resolve;
  });
  const authenticationGate = new Promise<void>((resolve) => {
    releaseAuthentication = resolve;
  });

  internals.authService.authenticate = async () => {
    authenticationStartedResolve?.();
    await authenticationGate;
    return testSession;
  };

  const connectPromise = runtime.connect();
  await authenticationStarted;

  const disconnected = await runtime.disconnect("cancel test");
  releaseAuthentication?.();

  await assert.rejects(connectPromise, /Connect attempt cancelled/);
  assert.equal(disconnected.state, "disconnected");
  assert.equal(runtime.getStatus().state, "disconnected");
  assert.equal(runtime.getStatus().reconnectInProgress, false);
});

test("manual disconnect cancels a scheduled automatic reconnect", async () => {
  const runtime = createRuntime({
    autoReconnect: true,
    reconnectBaseDelayMs: 100,
    reconnectMaxDelayMs: 100,
    maxAutoReconnectAttempts: 1
  });
  const internals = runtime as unknown as RuntimeInternals;
  let authenticateCalls = 0;
  internals.authService.authenticate = async () => {
    authenticateCalls += 1;
    return testSession;
  };

  internals.scheduleAutoReconnect("test");
  assert.equal(runtime.getStatus().reconnectInProgress, true);

  await runtime.disconnect("cancel reconnect test");
  await new Promise((resolve) => setTimeout(resolve, 150));

  assert.equal(authenticateCalls, 0);
  assert.equal(runtime.getStatus().state, "disconnected");
  assert.equal(runtime.getStatus().reconnectInProgress, false);
});

test("manual disconnect delegates to the adapter, waits for cleanup, and is idempotent", async () => {
  const runtime = createRuntime();
  const internals = runtime as unknown as RuntimeInternals;
  const disconnect = runtime.disconnect.bind(runtime) as (
    reason?: string
  ) => Promise<RuntimeStatus>;
  let disconnectCalls = 0;
  let releaseDisconnect: (() => void) | undefined;
  const disconnectGate = new Promise<void>((resolve) => {
    releaseDisconnect = resolve;
  });
  internals.state = "spawned";
  internals.adapter.setRuntimeState("spawned");
  internals.adapter.disconnect = () => {
    disconnectCalls += 1;
    return disconnectGate;
  };

  const first = disconnect("adapter cleanup test");
  const second = disconnect("ignored duplicate reason");

  assert.equal(first, second);
  assert.equal(disconnectCalls, 1);
  assert.equal(runtime.getStatus().state, "disconnected");
  let settled = false;
  void first.then(() => {
    settled = true;
  });
  await Promise.resolve();
  assert.equal(settled, false);

  releaseDisconnect?.();
  const status = await first;
  assert.equal(status.state, "disconnected");
  assert.equal(settled, true);
});

test("manual disconnect records and propagates adapter cleanup failures", async () => {
  const runtime = createRuntime();
  const internals = runtime as unknown as RuntimeInternals;
  internals.state = "spawned";
  internals.adapter.setRuntimeState("spawned");
  internals.adapter.disconnect = async () => {
    throw new Error("adapter disconnect failed");
  };

  await assert.rejects(runtime.disconnect("failure test"), /adapter disconnect failed/);
  assert.equal(runtime.getStatus().state, "disconnected");
  assert.match(runtime.getStatus().lastError ?? "", /adapter disconnect failed/);
});

test("connect is rejected while adapter disconnect cleanup is in progress", async () => {
  const runtime = createRuntime();
  const internals = runtime as unknown as RuntimeInternals;
  let authenticateCalls = 0;
  let releaseDisconnect: (() => void) | undefined;
  const disconnectGate = new Promise<void>((resolve) => {
    releaseDisconnect = resolve;
  });
  internals.state = "spawned";
  internals.adapter.setRuntimeState("spawned");
  internals.adapter.disconnect = () => disconnectGate;
  internals.authService.authenticate = async () => {
    authenticateCalls += 1;
    throw new Error("authentication should not start");
  };

  const disconnecting = runtime.disconnect("connection exclusion test");
  await assert.rejects(runtime.connect(), /disconnect/i);
  assert.equal(authenticateCalls, 0);

  releaseDisconnect?.();
  await disconnecting;
});

test("connect failure delegates cleanup without removing unrelated bot listeners", async () => {
  const runtime = createRuntime();
  const internals = runtime as unknown as RuntimeInternals;
  const nativeBot = new EventEmitter() as EventEmitter & {
    quit(reason?: string): void;
    username: string;
  };
  nativeBot.username = "TestBot";
  nativeBot.quit = () => {};
  const unrelatedListener = (): void => {};
  nativeBot.on("unrelated", unrelatedListener);
  (internals.adapter as unknown as { bot: unknown }).bot = nativeBot;
  let adapterDisconnectCalls = 0;
  internals.authService.authenticate = async () => testSession;
  internals.adapter.connect = async () => {};
  internals.adapter.awaitReady = async () => {
    throw new Error("spawn failed");
  };
  internals.adapter.disconnect = async () => {
    adapterDisconnectCalls += 1;
    (internals.adapter as unknown as { bot: unknown }).bot = null;
  };

  await assert.rejects(runtime.connect({ maxRetries: 0 }), /spawn failed/);

  assert.equal(adapterDisconnectCalls, 1);
  assert.equal(nativeBot.listenerCount("unrelated"), 1);
  assert.equal(nativeBot.listenerCount("login"), 0);
  assert.equal(nativeBot.listenerCount("kicked"), 0);
  assert.equal(nativeBot.listenerCount("error"), 0);
  assert.equal(nativeBot.listenerCount("end"), 0);
});
