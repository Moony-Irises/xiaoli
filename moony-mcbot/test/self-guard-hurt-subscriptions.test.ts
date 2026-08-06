import assert from "node:assert/strict";
import test from "node:test";
import {
  SelfGuardHurtSubscriptionRegistry,
  type SelfGuardHurtEmitter,
  type SelfGuardHurtEventEntity,
  type SelfGuardHurtListener
} from "../src/runtime/self-guard-hurt-subscriptions.js";

interface TestConfig {
  enabled: boolean;
  label: string;
}

class TestHurtEmitter implements SelfGuardHurtEmitter {
  selfEntityId = 1;
  private readonly listeners = new Set<SelfGuardHurtListener>();

  on(_event: "entityHurt", listener: SelfGuardHurtListener): void {
    this.listeners.add(listener);
  }

  off(_event: "entityHurt", listener: SelfGuardHurtListener): void {
    this.listeners.delete(listener);
  }

  emit(entity: SelfGuardHurtEventEntity): void {
    for (const listener of this.listeners) listener(entity);
  }

  get listenerCount(): number {
    return this.listeners.size;
  }
}

function createRegistry(
  getCurrentConfig: (botId: string) => TestConfig | undefined
): SelfGuardHurtSubscriptionRegistry<TestConfig, TestHurtEmitter> {
  return new SelfGuardHurtSubscriptionRegistry({
    getCurrentConfig,
    getSelfEntityId: (emitter) => emitter.selfEntityId
  });
}

function recordCalls(calls: Array<{ botId: string; config: TestConfig; emitter: TestHurtEmitter }>) {
  return (botId: string, config: TestConfig, emitter: TestHurtEmitter): void => {
    calls.push({ botId, config, emitter });
  };
}

test("self-guard hurt subscription binds once for the same bot emitter", () => {
  const calls: Array<{ botId: string; config: TestConfig; emitter: TestHurtEmitter }> = [];
  const config = { enabled: true, label: "current" };
  const registry = createRegistry(() => config);
  const emitter = new TestHurtEmitter();
  const onSelfHurt = recordCalls(calls);

  assert.equal(registry.ensure("bot-a", emitter, onSelfHurt), true);
  assert.equal(registry.ensure("bot-a", emitter, onSelfHurt), false);
  assert.equal(emitter.listenerCount, 1);

  emitter.emit({ id: 1 });
  assert.equal(calls.length, 1);
});

test("self-guard hurt subscription resolves the current config when the event fires", () => {
  const calls: Array<{ botId: string; config: TestConfig; emitter: TestHurtEmitter }> = [];
  let currentConfig: TestConfig | undefined = { enabled: true, label: "before reload" };
  const registry = createRegistry(() => currentConfig);
  const emitter = new TestHurtEmitter();
  registry.ensure("bot-a", emitter, recordCalls(calls));

  currentConfig = { enabled: true, label: "after reload" };
  emitter.emit({ id: 1 });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.config, currentConfig);
});

test("self-guard hurt subscription ignores foreign, missing, and disabled events", () => {
  const calls: Array<{ botId: string; config: TestConfig; emitter: TestHurtEmitter }> = [];
  let currentConfig: TestConfig | undefined = { enabled: true, label: "enabled" };
  const registry = createRegistry(() => currentConfig);
  const emitter = new TestHurtEmitter();
  registry.ensure("bot-a", emitter, recordCalls(calls));

  emitter.emit({ id: 2 });
  emitter.emit({});
  currentConfig = { enabled: false, label: "disabled" };
  emitter.emit({ id: 1 });
  currentConfig = undefined;
  emitter.emit({ id: 1 });

  assert.deepEqual(calls, []);
});

test("self-guard hurt subscription replaces emitters and detaches on delete", () => {
  const calls: Array<{ botId: string; config: TestConfig; emitter: TestHurtEmitter }> = [];
  const config = { enabled: true, label: "current" };
  const registry = createRegistry(() => config);
  const first = new TestHurtEmitter();
  const second = new TestHurtEmitter();
  const onSelfHurt = recordCalls(calls);

  registry.ensure("bot-a", first, onSelfHurt);
  assert.equal(registry.ensure("bot-a", second, onSelfHurt), true);
  assert.equal(first.listenerCount, 0);
  assert.equal(second.listenerCount, 1);

  first.emit({ id: 1 });
  second.emit({ id: 1 });
  assert.deepEqual(calls.map((entry) => entry.emitter), [second]);

  assert.deepEqual(registry.keys(), ["bot-a"]);
  assert.equal(registry.delete("bot-a"), true);
  assert.equal(registry.delete("bot-a"), false);
  assert.equal(second.listenerCount, 0);
  assert.deepEqual(registry.keys(), []);
});
