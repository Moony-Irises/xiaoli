import assert from "node:assert/strict";
import test from "node:test";
import { ActionCommandSet } from "../src/commands/action-command-set.js";
import type {
  ActionCommandRuntime,
  ActionCommandRuntimeRegistry
} from "../src/commands/action-command-set.js";
import type {
  ActionResult,
  EatFoodInput,
  HoldItemByCategoryInput,
  OpenDoorInput
} from "../src/runtime/client-adapter.js";

class FakeActionCommandRuntime implements ActionCommandRuntime {
  readonly eatCalls: EatFoodInput[] = [];
  readonly holdCategoryCalls: HoldItemByCategoryInput[] = [];
  readonly openDoorCalls: OpenDoorInput[] = [];
  eatError: Error | null = null;

  async eatFood(input: EatFoodInput = {}): Promise<ActionResult> {
    this.eatCalls.push({ ...input });
    if (this.eatError) throw this.eatError;
    return { ok: true, detail: `ate ${input.itemName ?? "food"}` };
  }

  async holdItemByCategory(input: HoldItemByCategoryInput): Promise<ActionResult> {
    this.holdCategoryCalls.push({ ...input });
    return { ok: true, detail: `equipped ${input.category}` };
  }

  async openDoor(input: OpenDoorInput = {}): Promise<ActionResult> {
    this.openDoorCalls.push({ ...input });
    return { ok: true, detail: "toggled door" };
  }
}

function createRegistry(
  botId: string,
  runtime: ActionCommandRuntime
): ActionCommandRuntimeRegistry {
  return {
    get(requestedBotId) {
      if (requestedBotId !== botId) {
        throw new Error(`Bot '${requestedBotId}' not found`);
      }
      return runtime;
    }
  };
}

test("ActionCommandSet invokes all canonical handlers and records typed history", async () => {
  const botId = "action-command-set";
  const runtime = new FakeActionCommandRuntime();
  const stoppedBots: string[] = [];
  const commands = new ActionCommandSet({
    registry: createRegistry(botId, runtime),
    stopFollow(requestedBotId) {
      stoppedBots.push(requestedBotId);
    }
  });

  assert.deepEqual(
    await commands.invokeStopFollow({ botId, source: "web" }),
    { botId, stopped: true, message: "Stopped following" }
  );
  assert.deepEqual(
    await commands.invokeEat(
      { botId, source: "agent", requester: "agent" },
      { itemName: "cooked_salmon" }
    ),
    { botId, action: "eatFood", result: { ok: true, detail: "ate cooked_salmon" } }
  );
  assert.deepEqual(
    await commands.invokeHoldByCategory(
      { botId, source: "mcp" },
      { category: "pickaxe" }
    ),
    { action: "hold-category", result: { ok: true, detail: "equipped pickaxe" } }
  );
  assert.deepEqual(
    await commands.invokeOpenDoor(
      { botId, source: "web" },
      { reach: 5, radius: 7 }
    ),
    { botId, action: "openDoor", result: { ok: true, detail: "toggled door" } }
  );

  assert.deepEqual(stoppedBots, [botId]);
  assert.deepEqual(runtime.eatCalls, [{ itemName: "cooked_salmon" }]);
  assert.deepEqual(runtime.holdCategoryCalls, [{ category: "pickaxe" }]);
  assert.deepEqual(runtime.openDoorCalls, [{ reach: 5, radius: 7 }]);
  assert.deepEqual(
    commands.getHistory().map(({ commandId, source, requester, status }) => ({
      commandId,
      source,
      requester,
      status
    })),
    [
      { commandId: "interact.openDoor", source: "web", requester: undefined, status: "executed" },
      { commandId: "inventory.holdByCategory", source: "mcp", requester: undefined, status: "executed" },
      { commandId: "interact.eat", source: "agent", requester: "agent", status: "executed" },
      { commandId: "move.stopFollow", source: "web", requester: undefined, status: "executed" }
    ]
  );
});

test("ActionCommandSet rethrows runtime failures after recording failed history", async () => {
  const botId = "action-command-failure";
  const runtime = new FakeActionCommandRuntime();
  runtime.eatError = new Error("cannot eat now");
  const commands = new ActionCommandSet({
    registry: createRegistry(botId, runtime),
    stopFollow() {}
  });

  await assert.rejects(
    commands.invokeEat({ botId, source: "mcp" }),
    /cannot eat now/
  );

  const history = commands.getHistory();
  assert.deepEqual(
    history,
    [
      {
        requestId: history[0]?.requestId,
        commandId: "interact.eat",
        source: "mcp",
        botId,
        status: "failed",
        startedAt: history[0]?.startedAt,
        completedAt: history[0]?.completedAt,
        durationMs: history[0]?.durationMs,
        error: { code: "execution_failed", message: "cannot eat now" }
      }
    ]
  );
});
