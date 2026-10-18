import assert from "node:assert/strict";
import test from "node:test";
import type { PlayerSnapshot } from "../src/runtime/client-adapter.js";
import { TerritoryPresenceStore } from "../src/runtime/territory-presence-store.js";
import {
  TerritoryRuntime,
  type TerritoryRuntimeActionContext,
  type TerritoryRuntimeHooks,
  type TerritoryRuntimeInput
} from "../src/runtime/territory-runtime.js";

const home = {
  placeId: "home",
  label: "家",
  x: 0,
  y: 64,
  z: 0
};

function playerAt(username: string, entityId: number, x: number): PlayerSnapshot {
  return {
    username,
    entityId,
    position: { x, y: 64, z: 0 }
  };
}

function inputAt(
  now: number,
  overrides: Partial<TerritoryRuntimeInput> = {}
): TerritoryRuntimeInput {
  return {
    botId: "bot-a",
    now,
    players: [playerAt("Intruder", 7, 1)],
    places: [home],
    radius: 4,
    ownerUsername: "Judy",
    whitelist: new Set<string>(),
    selfUsername: "NekoMaoLi",
    ownerPresencePolicy: "always",
    warningCooldownMs: 100,
    escalationEnabled: true,
    escalationDelayMs: 50,
    ...overrides
  };
}

function hooksWith(
  overrides: Partial<TerritoryRuntimeHooks> = {}
): TerritoryRuntimeHooks {
  return {
    onWarning: () => undefined,
    onEscalationHeld: () => undefined,
    onEscalation: () => undefined,
    ...overrides
  };
}

test("territory runtime writes first warning state before invoking effects", () => {
  const store = new TerritoryPresenceStore();
  const runtime = new TerritoryRuntime(store);
  const effects: string[] = [];

  const result = runtime.tick(inputAt(100), hooksWith({
    onWarning: (context) => {
      effects.push(`warn:${context.presenceKey}`);
      assert.deepEqual(store.get("bot-a", "home:Intruder"), {
        enteredAt: 100,
        warnedAt: 100
      });
    }
  }));

  assert.equal(result.action, "warn");
  assert.equal(result.handled, true);
  assert.equal(result.intruder?.username, "Intruder");
  assert.deepEqual(effects, ["warn:home:Intruder"]);
});

test("territory runtime preserves warning priority before later escalation", () => {
  const runtime = new TerritoryRuntime();
  const effects: string[] = [];
  const hooks = hooksWith({
    onWarning: () => effects.push("warn"),
    onEscalation: () => effects.push("escalate")
  });

  assert.equal(runtime.tick(inputAt(100, { warningCooldownMs: 50 }), hooks).action, "warn");
  assert.equal(runtime.tick(inputAt(150, { warningCooldownMs: 50 }), hooks).action, "warn");
  assert.equal(runtime.tick(inputAt(151, { warningCooldownMs: 50 }), hooks).action, "escalate");
  assert.equal(runtime.tick(inputAt(152, { warningCooldownMs: 50 }), hooks).action, "none");
  assert.deepEqual(effects, ["warn", "warn", "escalate"]);
});

test("territory runtime holds escalation until the owner is nearby", () => {
  const runtime = new TerritoryRuntime();
  const effects: string[] = [];
  const hooks = hooksWith({
    onWarning: () => effects.push("warn"),
    onEscalationHeld: () => effects.push("hold"),
    onEscalation: () => effects.push("escalate")
  });
  const ownerPolicy = { ownerPresencePolicy: "owner_nearby_only" as const };

  runtime.tick(inputAt(100, ownerPolicy), hooks);
  const held = runtime.tick(inputAt(150, ownerPolicy), hooks);
  const escalated = runtime.tick(inputAt(151, {
    ...ownerPolicy,
    players: [playerAt("Intruder", 7, 1), playerAt("Judy", 8, 2)]
  }), hooks);

  assert.deepEqual({ action: held.action, handled: held.handled }, {
    action: "hold_escalation",
    handled: false
  });
  assert.deepEqual({ action: escalated.action, handled: escalated.handled }, {
    action: "escalate",
    handled: true
  });
  assert.deepEqual(effects, ["warn", "hold", "escalate"]);
});

test("territory runtime prunes players who leave so re-entry warns again", () => {
  const runtime = new TerritoryRuntime();
  let warningCount = 0;
  const hooks = hooksWith({ onWarning: () => { warningCount += 1; } });

  runtime.tick(inputAt(100), hooks);
  const absent = runtime.tick(inputAt(110, { players: [] }), hooks);
  const returned = runtime.tick(inputAt(120), hooks);

  assert.equal(absent.action, "none");
  assert.equal(absent.intruder, null);
  assert.equal(returned.action, "warn");
  assert.equal(warningCount, 2);
});

test("territory runtime isolates bots and clearBot resets only one bot", () => {
  const runtime = new TerritoryRuntime();
  const warnings: string[] = [];
  const hooks = hooksWith({
    onWarning: (context) => warnings.push(context.botId)
  });

  runtime.tick(inputAt(100), hooks);
  runtime.tick(inputAt(100, { botId: "bot-b" }), hooks);
  assert.equal(runtime.tick(inputAt(110), hooks).action, "none");
  assert.equal(runtime.tick(inputAt(110, { botId: "bot-b" }), hooks).action, "none");

  assert.equal(runtime.clearBot("bot-a"), true);
  assert.equal(runtime.clearBot("missing"), false);
  assert.equal(runtime.tick(inputAt(110), hooks).action, "warn");
  assert.equal(runtime.tick(inputAt(110, { botId: "bot-b" }), hooks).action, "none");
  assert.deepEqual(warnings, ["bot-a", "bot-b", "bot-a"]);
});

test("territory runtime preserves escalated state when an effect throws", () => {
  const store = new TerritoryPresenceStore();
  const runtime = new TerritoryRuntime(store);
  runtime.tick(inputAt(100), hooksWith());

  assert.throws(
    () => runtime.tick(inputAt(150), hooksWith({
      onEscalation: (_context: TerritoryRuntimeActionContext) => {
        throw new Error("escalation effect failed");
      }
    })),
    /escalation effect failed/
  );
  assert.deepEqual(store.get("bot-a", "home:Intruder"), {
    enteredAt: 100,
    warnedAt: 100,
    escalatedAt: 150
  });
  assert.equal(runtime.tick(inputAt(151), hooksWith()).action, "none");
});
