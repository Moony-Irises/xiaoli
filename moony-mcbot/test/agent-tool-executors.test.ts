import assert from "node:assert/strict";
import test from "node:test";
import {
  AgentEatExecutor,
  AgentLookExecutor,
  AgentTimedWalkInput,
  AgentWalkExecutor,
  executeAgentEatTool,
  executeAgentLookTool,
  executeAgentWalkTool
} from "../src/agent/tool-executors.js";
import type { EatFoodInput } from "../src/runtime/client-adapter.js";
import type { BotRegistry } from "../src/runtime/bot-registry.js";
import { executeAgentToolCall } from "../src/tools/action-tools.js";

test("executeAgentEatTool uses the best available food when itemName is omitted", async () => {
  const calls: EatFoodInput[] = [];
  const executor: AgentEatExecutor = {
    async eatFood(input = {}) {
      calls.push(input);
      return { ok: true, detail: "ate 'bread'" };
    }
  };

  assert.equal(await executeAgentEatTool(executor, {}), "ate 'bread'");
  assert.deepEqual(calls, [{}]);
});

test("executeAgentEatTool trims an explicit item name", async () => {
  const calls: EatFoodInput[] = [];
  const executor: AgentEatExecutor = {
    async eatFood(input = {}) {
      calls.push(input);
      return { ok: true };
    }
  };

  assert.equal(
    await executeAgentEatTool(executor, { itemName: "  cooked_salmon  " }),
    "ate food"
  );
  assert.deepEqual(calls, [{ itemName: "cooked_salmon" }]);
});

test("executeAgentEatTool rejects invalid itemName values before calling runtime", async () => {
  let callCount = 0;
  const executor: AgentEatExecutor = {
    async eatFood() {
      callCount += 1;
      return { ok: true };
    }
  };

  await assert.rejects(
    executeAgentEatTool(executor, { itemName: 42 }),
    /itemName must be a string/
  );
  await assert.rejects(
    executeAgentEatTool(executor, { itemName: "   " }),
    /itemName must be non-empty/
  );
  assert.equal(callCount, 0);
});

test("executeAgentEatTool turns unsuccessful results into execution failures", async () => {
  const executor: AgentEatExecutor = {
    async eatFood() {
      return { ok: false, detail: "cannot eat while full" };
    }
  };

  await assert.rejects(
    executeAgentEatTool(executor, {}),
    /cannot eat while full/
  );
});

test("executeAgentEatTool preserves runtime errors", async () => {
  const executor: AgentEatExecutor = {
    async eatFood() {
      throw new Error("No edible item found in inventory");
    }
  };

  await assert.rejects(
    executeAgentEatTool(executor, {}),
    /No edible item found in inventory/
  );
});

test("executeAgentLookTool uses finite angles and defaults force to true", async () => {
  const calls: Array<{ yaw: number; pitch: number; force?: boolean }> = [];
  const executor: AgentLookExecutor = {
    async look(yaw, pitch, force) {
      calls.push({ yaw, pitch, force });
      return { ok: true };
    }
  };

  assert.equal(
    await executeAgentLookTool(executor, { yaw: 0, pitch: -0.25 }),
    "look set to yaw=0, pitch=-0.25"
  );
  assert.deepEqual(calls, [{ yaw: 0, pitch: -0.25, force: true }]);
});

test("executeAgentLookTool rejects invalid arguments before calling runtime", async () => {
  let callCount = 0;
  const executor: AgentLookExecutor = {
    async look() {
      callCount += 1;
      return { ok: true };
    }
  };

  const invalidArgs: Array<{ args: Record<string, unknown>; error: RegExp }> = [
    { args: { pitch: 0 }, error: /yaw must be a finite number/ },
    { args: { yaw: "0", pitch: 0 }, error: /yaw must be a finite number/ },
    { args: { yaw: Number.NaN, pitch: 0 }, error: /yaw must be a finite number/ },
    { args: { yaw: 0 }, error: /pitch must be a finite number/ },
    { args: { yaw: 0, pitch: Number.POSITIVE_INFINITY }, error: /pitch must be a finite number/ },
    { args: { yaw: 0, pitch: 0, force: "false" }, error: /force must be a boolean/ }
  ];

  for (const { args, error } of invalidArgs) {
    await assert.rejects(executeAgentLookTool(executor, args), error);
  }
  assert.equal(callCount, 0);
});

test("executeAgentLookTool turns unsuccessful results into execution failures", async () => {
  const executor: AgentLookExecutor = {
    async look() {
      return { ok: false, detail: "look rejected" };
    }
  };

  await assert.rejects(
    executeAgentLookTool(executor, { yaw: 0, pitch: 0 }),
    /look rejected/
  );
});

test("executeAgentLookTool preserves runtime errors", async () => {
  const executor: AgentLookExecutor = {
    async look() {
      throw new Error("Bot is disconnected");
    }
  };

  await assert.rejects(
    executeAgentLookTool(executor, { yaw: 0, pitch: 0 }),
    /Bot is disconnected/
  );
});

test("executeAgentWalkTool applies MCP-compatible defaults", async () => {
  const calls: AgentTimedWalkInput[] = [];
  const executor: AgentWalkExecutor = {
    async walkForDuration(input) {
      calls.push(input);
      return { ok: true };
    }
  };

  assert.equal(
    await executeAgentWalkTool(executor, {}),
    "walking forward for 1000ms (sprint=false, jump=false)"
  );
  assert.deepEqual(calls, [{ durationMs: 1000, sprint: false, jump: false }]);
});

test("executeAgentWalkTool accepts duration boundaries and explicit flags", async () => {
  const calls: AgentTimedWalkInput[] = [];
  const executor: AgentWalkExecutor = {
    async walkForDuration(input) {
      calls.push(input);
      return { ok: true, detail: `walk:${input.durationMs}` };
    }
  };

  assert.equal(
    await executeAgentWalkTool(executor, { durationMs: 100, sprint: true, jump: false }),
    "walk:100"
  );
  assert.equal(
    await executeAgentWalkTool(executor, { durationMs: 60000, sprint: false, jump: true }),
    "walk:60000"
  );
  assert.deepEqual(calls, [
    { durationMs: 100, sprint: true, jump: false },
    { durationMs: 60000, sprint: false, jump: true }
  ]);
});

test("executeAgentWalkTool rejects invalid arguments before starting movement", async () => {
  let callCount = 0;
  const executor: AgentWalkExecutor = {
    async walkForDuration() {
      callCount += 1;
      return { ok: true };
    }
  };
  const invalidArgs: Array<{ args: Record<string, unknown>; error: RegExp }> = [
    { args: { durationMs: 99 }, error: /durationMs must be an integer/ },
    { args: { durationMs: 60001 }, error: /durationMs must be an integer/ },
    { args: { durationMs: 100.5 }, error: /durationMs must be an integer/ },
    { args: { durationMs: Number.NaN }, error: /durationMs must be an integer/ },
    { args: { durationMs: "1000" }, error: /durationMs must be an integer/ },
    { args: { durationMs: null }, error: /durationMs must be an integer/ },
    { args: { sprint: "false" }, error: /sprint must be a boolean/ },
    { args: { jump: 1 }, error: /jump must be a boolean/ }
  ];

  for (const { args, error } of invalidArgs) {
    await assert.rejects(executeAgentWalkTool(executor, args), error);
  }
  assert.equal(callCount, 0);
});

test("executeAgentWalkTool turns unsuccessful results into execution failures", async () => {
  const executor: AgentWalkExecutor = {
    async walkForDuration() {
      return { ok: false, detail: "movement unavailable" };
    }
  };

  await assert.rejects(
    executeAgentWalkTool(executor, {}),
    /movement unavailable/
  );
});

test("executeAgentWalkTool preserves runtime errors", async () => {
  const executor: AgentWalkExecutor = {
    async walkForDuration() {
      throw new Error("Bot is disconnected");
    }
  };

  await assert.rejects(
    executeAgentWalkTool(executor, {}),
    /Bot is disconnected/
  );
});

test("Agent dispatcher routes interact.eat through BotRuntime", async () => {
  const calls: EatFoodInput[] = [];
  const registry = {
    get(botId: string) {
      assert.equal(botId, "bot-1");
      return {
        async eatFood(input: EatFoodInput = {}) {
          calls.push(input);
          return { ok: true, detail: "ate 'cooked_salmon'" };
        }
      };
    }
  } as unknown as BotRegistry;

  assert.equal(
    await executeAgentToolCall(
      "bot-1",
      registry,
      "interact.eat",
      { itemName: " cooked_salmon " }
    ),
    "ate 'cooked_salmon'"
  );
  assert.deepEqual(calls, [{ itemName: "cooked_salmon" }]);
});

test("Agent dispatcher routes player.look through BotRuntime", async () => {
  const calls: Array<{ yaw: number; pitch: number; force?: boolean }> = [];
  const registry = {
    get(botId: string) {
      assert.equal(botId, "bot-1");
      return {
        async look(yaw: number, pitch: number, force?: boolean) {
          calls.push({ yaw, pitch, force });
          return { ok: true, detail: "looked" };
        }
      };
    }
  } as unknown as BotRegistry;

  assert.equal(
    await executeAgentToolCall(
      "bot-1",
      registry,
      "player.look",
      { yaw: 0, pitch: -0.25, force: false }
    ),
    "looked"
  );
  assert.deepEqual(calls, [{ yaw: 0, pitch: -0.25, force: false }]);
});

test("Agent dispatcher starts movement.walk and stops it after the requested duration", async () => {
  const calls: string[] = [];
  const registry = {
    get(botId: string) {
      assert.equal(botId, "bot-1");
      return {
        supportsClientCapability() {
          return true;
        },
        async stopMovement() {
          calls.push("stop");
          return { ok: true, detail: "stopped" };
        },
        async walkForward(input: { sprint?: boolean; jump?: boolean }) {
          calls.push(`walk:${input.sprint}:${input.jump}`);
          return { ok: true, detail: "walking" };
        }
      };
    }
  } as unknown as BotRegistry;

  assert.equal(
    await executeAgentToolCall(
      "bot-1",
      registry,
      "movement.walk",
      { durationMs: 100, sprint: false, jump: true }
    ),
    "walking forward for 100ms (sprint=false, jump=true)"
  );
  assert.deepEqual(calls, ["stop", "walk:false:true"]);

  await new Promise((resolve) => setTimeout(resolve, 130));
  assert.deepEqual(calls, ["stop", "walk:false:true", "stop"]);
});

test("Agent dispatcher does not start movement.walk when current movement cannot stop", async () => {
  let walkCount = 0;
  const registry = {
    get() {
      return {
        supportsClientCapability() {
          return true;
        },
        async stopMovement() {
          return { ok: false, detail: "cannot stop current movement" };
        },
        async walkForward() {
          walkCount += 1;
          return { ok: true };
        }
      };
    }
  } as unknown as BotRegistry;

  await assert.rejects(
    executeAgentToolCall("bot-1", registry, "movement.walk", { durationMs: 100 }),
    /cannot stop current movement/
  );
  assert.equal(walkCount, 0);
});

test("Agent dispatcher accepts move.goToPosition without a native Mineflayer bot", async () => {
  let nativeBotLookupCount = 0;
  let movementUnsubscribeCount = 0;
  const stopCalls: string[] = [];
  const registry = {
    get(botId: string) {
      assert.equal(botId, "bot-1");
      return {
        supportsClientCapability() {
          return true;
        },
        getActiveBotOrThrow() {
          nativeBotLookupCount += 1;
          throw new Error("native bot lookup is not allowed");
        },
        getSelfState() {
          return { position: { x: 10, y: 64, z: -5 } };
        },
        subscribeMovementEvents() {
          return () => {
            movementUnsubscribeCount += 1;
          };
        },
        async stopMovement() {
          stopCalls.push("stop");
          return { ok: true, detail: "stopped" };
        }
      };
    }
  } as unknown as BotRegistry;

  assert.equal(
    await executeAgentToolCall(
      "bot-1",
      registry,
      "move.goToPosition",
      { x: 10, y: 64, z: -5 }
    ),
    "moving_to=10,64,-5, stopRadius=2.3"
  );
  assert.equal(nativeBotLookupCount, 0);

  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.equal(movementUnsubscribeCount, 1);
  assert.ok(stopCalls.length >= 2);
});

test("Agent internal observe.self builds its summary without a native Mineflayer bot", async () => {
  let nativeBotLookupCount = 0;
  const registry = {
    get(botId: string) {
      assert.equal(botId, "summary-bot");
      return {
        getActiveBotOrThrow() {
          nativeBotLookupCount += 1;
          throw new Error("native bot lookup is not allowed");
        },
        getSelfState() {
          return { health: 17.75, food: 14 };
        },
        getNearbyPlayers() {
          return [
            { username: "Zed", distance: 8.25 },
            { username: "Alice", distance: 2 }
          ];
        },
        getNearbyEntities() {
          return [
            { name: "cow", type: "mob", distance: 5 },
            { name: "ignored_player", type: "player", distance: 1 },
            { name: "zombie", type: "mob", distance: 3.25 }
          ];
        },
        getInventoryState() {
          return {
            heldItem: { name: "iron_pickaxe", count: 1 },
            armor: { head: null, torso: null, legs: null, feet: null },
            items: [
              { name: "bread", count: 3 },
              { name: "cooked_salmon", count: 1 }
            ]
          };
        }
      };
    }
  } as unknown as BotRegistry;

  assert.equal(
    await executeAgentToolCall("summary-bot", registry, "observe.self", {}),
    [
      "activity=待命",
      "health=17.8",
      "food=14/20",
      "held=iron_pickaxe",
      "bestFood=cooked_salmon",
      "followActive=false",
      "duelActive=false",
      "players=[Alice:2.0, Zed:8.3]",
      "entities=[zombie:3.3, cow:5.0]"
    ].join("\n")
  );
  assert.equal(nativeBotLookupCount, 0);
});

test("Agent internal observe.self keeps partial context when vitals are unavailable", async () => {
  const registry = {
    get() {
      return {
        getSelfState() {
          return { health: Number.NaN, food: Number.POSITIVE_INFINITY };
        },
        getNearbyPlayers() {
          return [];
        },
        getNearbyEntities() {
          return [];
        },
        getInventoryState() {
          return {
            heldItem: null,
            armor: { head: null, torso: null, legs: null, feet: null },
            items: []
          };
        }
      };
    }
  } as unknown as BotRegistry;

  const summary = await executeAgentToolCall("partial-summary-bot", registry, "observe.self", {});
  assert.match(summary, /^activity=待命\nhealth=unknown\nfood=unknown\n/);
  assert.match(summary, /held=empty\nbestFood=none/);
  assert.doesNotMatch(summary, /state=unavailable/);
});
