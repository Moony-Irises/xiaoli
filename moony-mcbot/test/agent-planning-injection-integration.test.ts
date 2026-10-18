import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import type { Bot as MineflayerBot } from "mineflayer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type { SelfStateSnapshot } from "../src/runtime/client-adapter.js";
import type { RuntimeState } from "../src/types.js";
import type { AgentPlanningDecision, AgentPlanningInput } from "../src/agent/planning-strategy.js";
import { buildDirectiveFromPlan } from "../src/agent/plan-to-directive.js";
import type { AgentPlan } from "../src/agent/openai-agent-planner.js";
import {
  debugClearStrategicGoal, debugRunAgentOnce, flushActionPersistence,
  getAgentStatusForDebug,
  registerActionTools, reloadPersistedChatState, stopActionRuntime
} from "../src/tools/action-tools.js";
import { FakeClientAdapter } from "./helpers/fake-client-adapter.js";

interface ToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}
interface ServerInternals {
  _registeredTools: Record<string, { handler(args: Record<string, unknown>, extra: never): Promise<ToolResponse> }>;
}
function deferred<T>() {
  let resolvePromise: (value: T) => void = () => { throw new Error("deferred not initialized"); };
  let rejectPromise: (error: unknown) => void = () => { throw new Error("deferred not initialized"); };
  const promise = new Promise<T>((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}
function idle(): AgentPlanningDecision {
  return { plan: { intent: "no_action" }, directive: null, leftoverSteps: [] };
}
function actionable(botId: string): AgentPlanningDecision {
  const plan: AgentPlan = { intent: "execute_skill", directive: {
    goal: "Recover", rationale: "test", desiredMode: "auto", milestones: ["Eat", "Wait"], currentMilestoneIndex: 1,
    actions: [{ kind: "eat_food" }]
  } };
  return { plan, ...buildDirectiveFromPlan(botId, "Eat", plan, 2) };
}
function bounded<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("test request did not start")), 5000);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

class PlanningAdapter extends FakeClientAdapter {
  ownerReads = 0;
  speech: string[] = [];
  override getSelfState(): SelfStateSnapshot {
    return { username: "bot", position: { x: 0, y: 64, z: 0 }, health: 20, food: 20 };
  }
  override getPlayerSnapshot(_username: string): null { this.ownerReads++; return null; }
  override async sendChat(text: string) { this.speech.push(text); return { ok: true, detail: "sent" }; }
}

test("injected production strategy is shared by MCP, Web and automatic planning with guarded commits", async (t) => {
  const gates = new Map<string, ReturnType<typeof deferred<AgentPlanningDecision>>>();
  const starts = new Map<string, ReturnType<typeof deferred<AgentPlanningInput>>>();
  const observed: AgentPlanningInput[] = [];
  const adapters = new Map<string, PlanningAdapter>();
  let nextAdapter: PlanningAdapter;
  const registry = new BotRegistry({ clientAdapterKind: "modded-client", clientAdapterFactory: { create: () => nextAdapter } });
  const server = new McpServer({ name: "planning-injection-test", version: "1.0.0" });
  const invoke = async (name: string, args: Record<string, unknown>): Promise<ToolResponse> => {
    const handler = (server as unknown as ServerInternals)._registeredTools[name]?.handler;
    assert.ok(handler, `Missing tool ${name}`);
    return handler(args, {} as never);
  };
  const configureBot = async (botId: string): Promise<void> => {
    nextAdapter = new PlanningAdapter("modded-client");
    adapters.set(botId, nextAdapter);
    const runtime = registry.create({ botId, authApiBaseUrl: "http://127.0.0.1:1", username: "test",
      password: "not-used", serverHost: "127.0.0.1", autoReconnect: false });
    runtime.getActiveBotOrThrow = () => ({
      entity: { position: { x: 0, y: 64, z: 0, offset: () => ({ x: 0, y: 65, z: 0 }) }, yaw: 0, pitch: 0, effects: {} },
      entities: {}, registry: { blocksByName: {} }, game: { dimension: "overworld" },
      time: { isDay: true }, blockAt: () => null, blockAtCursor: () => null
    } as unknown as MineflayerBot);
    (runtime as unknown as { state: RuntimeState }).state = "spawned";
    nextAdapter.setRuntimeState("spawned");
    const result = await invoke("agent.configure", { botId, enabled: true, mode: "manual", owner: "Judy", whitelist: ["Judy"],
      planCooldownMs: 1000, maxPlanSteps: 2, allowedTools: ["interact.eat"], allowProactiveAction: false });
    assert.equal(result.isError, undefined, result.content[0]?.text);
  };
  const queue = (key: string) => {
    const gate = deferred<AgentPlanningDecision>();
    const started = deferred<AgentPlanningInput>();
    gates.set(key, gate); starts.set(key, started);
    return { gate, started };
  };
  const snapshot = async (botId: string) => {
    const response = await invoke("agent.framework.status", { botId });
    assert.equal(response.isError, undefined, response.content[0]?.text);
    return (JSON.parse(response.content[0]?.text ?? "{}") as { snapshot: {
      queuedActions: unknown[]; executionEvents: { type: string }[];
    } }).snapshot;
  };
  const assertCancelled = (result: ToolResponse): void => {
    assert.equal(result.isError, true, result.content[0]?.text);
    assert.match(result.content[0]?.text ?? "", /cancelled/);
  };

  try {
    await registerActionTools(server, registry, { agentPlanningStrategy: {
      decide: async (input) => {
        observed.push(input);
        const key = gates.has(input.userInstruction) ? input.userInstruction : input.botId;
        starts.get(key)?.resolve(input);
        return gates.get(key)?.promise ?? idle();
      }
    } });

    await t.test("MCP and Web use the injected strategy and retain raw plans and milestones", async () => {
      for (const entry of ["mcp", "web"] as const) {
        const botId = `injected-${entry}`;
        await configureBot(botId);
        const { gate, started } = queue(botId);
        const plan = actionable(botId);
        const pending = entry === "mcp"
          ? invoke("agent.runOnce", { botId, userInstruction: botId, requester: "Judy" })
          : debugRunAgentOnce(botId, registry, { userInstruction: botId, requester: "Judy" });
        const input = await bounded(started.promise);
        assert.ok(input.signal);
        gate.resolve(plan);
        const response = await pending;
        const result = entry === "mcp"
          ? JSON.parse((response as ToolResponse).content[0]?.text ?? "{}") as Record<string, unknown>
          : response as Record<string, unknown>;
        assert.deepEqual(result.plan, plan.plan);
        assert.equal(result.executionResult, "applied_directive_1_action(s)");
        const status = getAgentStatusForDebug(botId);
        const goal = status.strategicGoal as { milestones: string[]; currentMilestoneIndex: number };
        assert.deepEqual(goal.milestones, ["Eat", "Wait"]);
        assert.equal(goal.currentMilestoneIndex, 1);
        assert.equal(status.mode, "manual");
        assert.equal((await snapshot(botId)).queuedActions.length, 1);
      }
    });

    await t.test("superseded MCP requests cannot overwrite newer diagnostics before or after completion", async () => {
      for (const olderFirst of [false, true]) {
        const botId = `interleave-${olderFirst}`;
        await configureBot(botId);
        const old = queue(`${botId}-old`); const newer = queue(`${botId}-new`);
        const oldRequest = invoke("agent.runOnce", { botId, userInstruction: `${botId}-old` });
        await bounded(old.started.promise);
        const newRequest = invoke("agent.runOnce", { botId, userInstruction: `${botId}-new` });
        await bounded(newer.started.promise);
        if (olderFirst) {
          old.gate.resolve(actionable(botId));
          assertCancelled(await oldRequest);
          const status = getAgentStatusForDebug(botId);
          assert.equal((status.lastPlannerRequest as { state: string }).state, "running");
          assert.equal(status.runtimeState, "task_running");
          assert.equal((await snapshot(botId)).queuedActions.length, 0);
        }
        newer.gate.resolve(idle());
        assert.equal((await newRequest).isError, undefined);
        const before = getAgentStatusForDebug(botId);
        if (!olderFirst) {
          old.gate.reject(new Error("old request failed"));
          assertCancelled(await oldRequest);
        }
        const after = getAgentStatusForDebug(botId);
        assert.equal(after.lastPlanSummary, before.lastPlanSummary);
        assert.equal(after.lastPlanResult, before.lastPlanResult);
        assert.equal(after.runtimeState, "idle");
        assert.equal((after.lastPlannerRequest as { state: string }).state, "success");
        assert.equal((await snapshot(botId)).queuedActions.length, 0);
      }
    });

    await t.test("Web clear and configure cancel pending decisions without queued actions or speech", async () => {
      for (const operation of ["clear", "configure"]) {
        const botId = `cancel-${operation}`;
        await configureBot(botId);
        const { gate, started } = queue(botId);
        const pending = debugRunAgentOnce(botId, registry, { userInstruction: botId });
        const rejected = assert.rejects(pending, /cancelled/);
        await bounded(started.promise);
        if (operation === "clear") debugClearStrategicGoal(botId);
        else await invoke("agent.configure", { botId, enabled: false });
        gate.resolve(actionable(botId));
        await rejected;
        assert.equal((await snapshot(botId)).queuedActions.length, 0);
        assert.equal(getAgentStatusForDebug(botId).strategicGoal, null);
        assert.deepEqual(adapters.get(botId)?.speech, []);
      }
    });

    await t.test("configuration replacement and removal invalidate pending production turns", async () => {
      for (const remove of [false, true]) {
        const botId = `reload-${remove}`;
        await configureBot(botId);
        const { gate, started } = queue(botId);
        const pending = invoke("agent.runOnce", { botId, userInstruction: botId });
        await bounded(started.promise);
        await flushActionPersistence();
        const file = String(getAgentStatusForDebug(botId).persistedConfigPath);
        const state = JSON.parse(await readFile(file, "utf8")) as { agentByBotId: Record<string, { owner: string }> };
        if (remove) delete state.agentByBotId[botId];
        else state.agentByBotId[botId]!.owner = "NewOwner";
        await writeFile(file, JSON.stringify(state), "utf8");
        await reloadPersistedChatState(registry);
        gate.resolve(actionable(botId));
        assertCancelled(await pending);
        const status = getAgentStatusForDebug(botId);
        assert.equal(status.owner, remove ? "" : "NewOwner");
        assert.equal(status.strategicGoal, null);
        assert.equal(status.lastPlanAt, null);
        assert.equal((await snapshot(botId)).queuedActions.length, 0);
        assert.equal((status.lastPlannerRequest as { state: string }).state, remove ? "idle" : "cancelled");
      }
    });

    await t.test("cancelled automatic planning does not continue the idle follow policy", async () => {
      const botId = "automatic-cancelled";
      await configureBot(botId);
      const { gate, started } = queue(botId);
      const enabled = await invoke("agent.configure", { botId, mode: "auto", allowProactiveAction: true, autoIdlePolicy: "follow_owner" });
      assert.equal(enabled.isError, undefined);
      const input = await bounded(started.promise);
      assert.equal(input.botId, botId);
      const requested = (await snapshot(botId)).executionEvents.find((event) => event.type === "planner_requested");
      assert.ok(requested);
      const ownerReads = adapters.get(botId)!.ownerReads;
      await invoke("agent.configure", { botId, enabled: false });
      gate.resolve(actionable(botId));
      await flushActionPersistence();
      assert.equal(adapters.get(botId)?.ownerReads, ownerReads);
      assert.equal((await snapshot(botId)).queuedActions.length, 0);
      assert.deepEqual(adapters.get(botId)?.speech, []);
    });

    await t.test("shutdown suppresses pending decisions and stale MCP error cleanup", async () => {
      const botId = "shutdown-pending";
      await configureBot(botId);
      const { gate, started } = queue(botId);
      const pending = invoke("agent.runOnce", { botId, userInstruction: botId });
      await bounded(started.promise);
      const before = getAgentStatusForDebug(botId);
      stopActionRuntime();
      gate.resolve(actionable(botId));
      assertCancelled(await pending);
      const after = getAgentStatusForDebug(botId);
      assert.equal(after.lastPlanResult, before.lastPlanResult);
      assert.equal(after.strategicGoal, null);
      assert.equal((await snapshot(botId)).queuedActions.length, 0);
      assert.deepEqual(adapters.get(botId)?.speech, []);
    });
    assert.ok(observed.length >= 10);
  } finally {
    stopActionRuntime();
    await flushActionPersistence();
    await server.close();
  }
});
