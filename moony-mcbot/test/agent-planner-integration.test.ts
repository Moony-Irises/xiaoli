import assert from "node:assert/strict";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";
import type { Bot as MineflayerBot } from "mineflayer";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BotRegistry } from "../src/runtime/bot-registry.js";
import type { ActionResult, SelfStateSnapshot } from "../src/runtime/client-adapter.js";
import type { RuntimeState } from "../src/types.js";
import type { StrategicAction, StrategicDirective } from "../src/agent/types.js";
import {
  getAgentExecutionTraceForDebug,
  getAgentStateSnapshotForDebug,
  getAgentStatusForDebug,
  getCommandInvocationHistoryForDebug,
  registerActionTools,
  stopActionRuntime
} from "../src/tools/action-tools.js";
import { FakeClientAdapter } from "./helpers/fake-client-adapter.js";

interface ToolResponse {
  content: { type: string; text: string }[];
  isError?: boolean;
}

interface ServerInternals {
  _registeredTools: Record<string, {
    handler: (args: Record<string, unknown>, extra: never) => Promise<ToolResponse>;
  }>;
}

interface RequestBody {
  model: string;
  temperature: number;
  messages: { role: string; content: string }[];
}

interface FrameworkSnapshot {
  recentEvents: { type: string; payload: Record<string, unknown> }[];
  executionEvents: { type: string; payload: Record<string, unknown> }[];
  queuedActions: StrategicAction[];
  activeDirective: StrategicDirective | null;
}

interface Position {
  x: number;
  y: number;
  z: number;
  offset(dx: number, dy: number, dz: number): Position;
}

function position(x: number, y: number, z: number): Position {
  return { x, y, z, offset: (dx, dy, dz) => position(x + dx, y + dy, z + dz) };
}

class PlannerClientAdapter extends FakeClientAdapter {
  eatCount = 0;

  override getSelfState(): SelfStateSnapshot {
    return { username: "test-bot", position: position(123, 64, 456), health: 20, food: 20 };
  }

  override async eatFood(): Promise<ActionResult> {
    this.eatCount += 1;
    return { ok: true, detail: "ate 'bread'" };
  }
}

test("MCP planner requests preserve diagnostics, projection and the skill execution chain", async (t) => {
  const requests: RequestBody[] = [];
  let statusCode = 200;
  let replyContent = '{"intent":"no_action"}';
  const upstream = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as RequestBody);
    response.writeHead(statusCode, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: replyContent } }] }));
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const address = upstream.address();
  assert.ok(address && typeof address !== "string");

  let currentAdapter: PlannerClientAdapter;
  const registry = new BotRegistry({
    clientAdapterKind: "modded-client",
    clientAdapterFactory: { create: () => currentAdapter }
  });
  const server = new McpServer({ name: "planner-integration-test", version: "1.0.0" });
  const adapters = new Map<string, PlannerClientAdapter>();
  const invoke = async (name: string, args: Record<string, unknown>): Promise<ToolResponse> => {
    const handler = (server as unknown as ServerInternals)._registeredTools[name]?.handler;
    assert.ok(handler, `Missing tool ${name}`);
    return handler(args, {} as never);
  };
  const readFramework = async (botId: string): Promise<FrameworkSnapshot> => {
    const response = await invoke("agent.framework.status", { botId });
    assert.equal(response.isError, undefined, response.content[0]?.text);
    return (JSON.parse(response.content[0]?.text ?? "{}") as {
      snapshot: FrameworkSnapshot;
    }).snapshot;
  };
  const configureBot = async (
    botId: string,
    mode = "manual",
    allowedTools: string[] = ["interact.eat"],
    maxPlanSteps = 1
  ): Promise<void> => {
    const adapter = new PlannerClientAdapter("modded-client");
    currentAdapter = adapter;
    const runtime = registry.create({
      botId, authApiBaseUrl: "http://127.0.0.1:1", username: "test-user",
      password: "not-used", serverHost: "127.0.0.1", autoReconnect: false
    });
    // Snapshot collection still requires the legacy native compatibility exit.
    runtime.getActiveBotOrThrow = () => ({
      entity: { position: position(123, 64, 456), yaw: 0, pitch: 0, effects: {} },
      entities: {}, registry: { blocksByName: {} }, game: { dimension: "overworld" },
      time: { isDay: true }, blockAt: () => null, blockAtCursor: () => null
    } as unknown as MineflayerBot);
    (runtime as unknown as { state: RuntimeState }).state = "spawned";
    adapter.setRuntimeState("spawned");
    adapters.set(botId, adapter);
    const result = await invoke("agent.configure", {
      botId, enabled: true, mode, owner: "Judy", whitelist: ["Judy"],
      plannerApiBaseUrl: `http://127.0.0.1:${address.port}/v1`,
      plannerApiKey: "test-key", plannerModel: "test-planner",
      plannerSystemPrompt: "Return a plan.", planCooldownMs: 1000, allowProactiveAction: false,
      allowedTools, maxPlanSteps
    });
    assert.equal(result.isError, undefined, result.content[0]?.text);
  };

  try {
    await registerActionTools(server, registry);
    await t.test("no_action updates diagnostics and uses only the projected context", async () => {
      const botId = "planner-no-action";
      await configureBot(botId);
      const result = await invoke("agent.runOnce", { botId, userInstruction: "Stay idle.", requester: "Judy" });
      assert.equal(result.isError, undefined, result.content[0]?.text);
      const payload = JSON.parse(result.content[0]?.text ?? "{}") as Record<string, unknown>;
      assert.deepEqual(payload.plan, { intent: "no_action" });
      assert.equal(payload.executionResult, "no_action");
      assert.equal((getAgentStatusForDebug(botId).lastPlannerRequest as { state: string }).state, "success");
      const body = requests[0];
      assert.ok(body);
      assert.equal(body.model, "test-planner");
      assert.equal(body.temperature, 0.2);
      assert.deepEqual(body.messages[0], { role: "system", content: "Return a plan." });
      assert.deepEqual(body.messages.at(-1), { role: "user", content: "Stay idle." });
      const context = body.messages.find((message) => message.content.startsWith("任务上下文投影JSON:"));
      assert.ok(context);
      assert.doesNotMatch(context.content, /"position"|"botId"|"payload"/);

      const coolingDown = await invoke("agent.runOnce", { botId, userInstruction: "Again." });
      assert.equal(coolingDown.isError, true);
      assert.match(coolingDown.content[0]?.text ?? "", /cooling down/);
      assert.equal(requests.length, 1);

      const framework = await readFramework(botId);
      assert.ok(framework.executionEvents.some((event) => event.type === "planner_requested"));
      assert.ok(framework.executionEvents.some((event) => event.type === "planner_result"));
      const tailResponse = await invoke("agent.events.tail", { botId, count: 20 });
      assert.equal(tailResponse.isError, undefined, tailResponse.content[0]?.text);
      const tail = JSON.parse(tailResponse.content[0]?.text ?? "{}").events as { type: string }[];
      assert.ok(tail.some((event) => event.type === "planner_requested"));
      assert.ok(tail.some((event) => event.type === "planner_result"));
      const trace = getAgentExecutionTraceForDebug(botId);
      assert.ok((trace.recentEvents as { type: string }[]).some((event) => event.type === "planner_requested"));
      assert.ok((trace.recentEvents as { type: string }[]).some((event) => event.type === "planner_result"));
      const debugSnapshot = getAgentStateSnapshotForDebug(botId, registry);
      assert.ok((debugSnapshot.events as { type: string }[]).some((event) => event.type === "planner_requested"));
      assert.ok((debugSnapshot.events as { type: string }[]).some((event) => event.type === "planner_result"));
    });

    await t.test("request failures keep the error diagnostic and do not publish planner_result", async () => {
      for (const [name, status, content, expected] of [
        ["http", 429, "busy", /HTTP 429/],
        ["empty", 200, "", /returned empty content/],
        ["json", 200, "not json", /JSON|Unexpected token/],
        ["intent", 200, '{"intent":"invented"}', /invalid intent/]
      ] as const) {
        const botId = `planner-failed-${name}`;
        await configureBot(botId);
        statusCode = status;
        replyContent = content;
        const result = await invoke("agent.runOnce", { botId, userInstruction: "Stay idle." });
        assert.equal(result.isError, true);
        assert.match(result.content[0]?.text ?? "", expected);
        const state = getAgentStatusForDebug(botId);
        assert.equal((state.lastPlannerRequest as { state: string }).state, "failed");
        assert.equal(state.lastPlanAt, null);
        assert.equal(state.runtimeState, "idle");
        assert.equal((await readFramework(botId)).recentEvents.some((event) => event.type === "planner_result"), false);
      }
    });

    await t.test("explicit actions take precedence over legacy steps and speech consumes the action limit", async () => {
      const botId = "planner-explicit-limit";
      await configureBot(botId, "manual", ["interact.eat"], 3);
      statusCode = 200;
      replyContent = JSON.stringify({
        intent: "execute_skill",
        speak: " Ready. ",
        directive: {
          goal: " Stay nearby ", rationale: " explicit request ", desiredMode: "assist",
          actions: [{ kind: "stop_follow" }, { kind: "idle" }, { kind: "eat_food" }]
        },
        steps: [{ tool: "interact.eat" }]
      });
      const result = await invoke("agent.runOnce", { botId, userInstruction: "Wait." });
      assert.equal(result.isError, undefined, result.content[0]?.text);
      const payload = JSON.parse(result.content[0]?.text ?? "{}");
      assert.equal(payload.executionResult, "applied_directive_3_action(s)");
      assert.deepEqual(payload.plannedSteps, []);
      const framework = await readFramework(botId);
      assert.deepEqual(framework.queuedActions.map((action) => action.kind), ["speak", "stop_follow", "idle"]);
      assert.deepEqual(framework.queuedActions[0]?.params, { text: "Ready." });
      assert.equal(framework.activeDirective?.goal, "Stay nearby");
      assert.equal(framework.activeDirective?.rationale, "explicit request");
      assert.equal(framework.activeDirective?.desiredMode, "assist");
      assert.equal(getAgentStatusForDebug(botId).mode, "manual");
      assert.equal(adapters.get(botId)?.eatCount, 0);
    });

    await t.test("legacy steps translate known tools and keep unmapped tools in the compatibility queue", async () => {
      const botId = "planner-mixed-steps";
      await configureBot(botId, "manual", ["interact.eat", "observe.self"], 2);
      statusCode = 200;
      replyContent = JSON.stringify({
        intent: "execute_skill",
        steps: [{ tool: " interact.eat ", arguments: { food: "bread" } }, { tool: " observe.self ", speak: " Look. " }]
      });
      const result = await invoke("agent.runOnce", { botId, userInstruction: "Eat and observe." });
      assert.equal(result.isError, undefined, result.content[0]?.text);
      const payload = JSON.parse(result.content[0]?.text ?? "{}");
      assert.equal(payload.executionResult, "applied_directive_1_action(s);enqueued_1_step(s)");
      assert.deepEqual(payload.plannedSteps, [{ tool: "observe.self", arguments: {}, speak: "Look." }]);
      const framework = await readFramework(botId);
      assert.deepEqual(framework.queuedActions.map((action) => action.kind), ["eat_food", "tool_call"]);
      assert.deepEqual(framework.queuedActions[0]?.params, { food: "bread" });
      assert.deepEqual(framework.queuedActions[1]?.params, { tool: "observe.self", arguments: {}, speak: "Look." });
      assert.equal(framework.activeDirective?.rationale, "translated_from_legacy_tool_steps");
      assert.equal(adapters.get(botId)?.eatCount, 0);
    });

    await t.test("unmapped tool permissions are checked before compatibility steps are enqueued", async () => {
      const botId = "planner-disallowed-step";
      await configureBot(botId);
      statusCode = 200;
      replyContent = JSON.stringify({ intent: "execute_skill", tool: "observe.self" });
      const result = await invoke("agent.runOnce", { botId, userInstruction: "Observe." });
      assert.equal(result.isError, true);
      assert.match(result.content[0]?.text ?? "", /Tool 'observe.self' is not allowed for agent/);
      assert.deepEqual((await readFramework(botId)).queuedActions, []);
      assert.equal((getAgentStatusForDebug(botId).lastPlannerRequest as { state: string }).state, "success");
    });

    await t.test("unknown explicit action without a fallback reports a missing executable step", async () => {
      const botId = "planner-invalid-action";
      await configureBot(botId);
      statusCode = 200;
      replyContent = JSON.stringify({ intent: "execute_skill", directive: { actions: [{ kind: "invented" }] } });
      const result = await invoke("agent.runOnce", { botId, userInstruction: "Wait." });
      assert.equal(result.isError, true);
      assert.match(result.content[0]?.text ?? "", /Agent plan missing executable step/);
      const framework = await readFramework(botId);
      assert.deepEqual(framework.queuedActions, []);
      assert.equal(framework.activeDirective, null);
      assert.equal((getAgentStatusForDebug(botId).lastPlannerRequest as { state: string }).state, "success");
    });

    await t.test("directive reaches the blackboard, skill catalog, dispatcher and adapter", async () => {
      const botId = "planner-eat-chain";
      await configureBot(botId, "assist");
      statusCode = 200;
      replyContent = JSON.stringify({
        intent: "execute_skill",
        directive: { goal: "Recover safely", actions: [{ kind: "eat_food", params: {} }] }
      });
      const result = await invoke("agent.runOnce", { botId, userInstruction: "Eat." });
      assert.equal(result.isError, undefined, result.content[0]?.text);
      const payload = JSON.parse(result.content[0]?.text ?? "{}") as { executionResult: string };
      assert.equal(payload.executionResult, "applied_directive_1_action(s)");
      assert.deepEqual((await readFramework(botId)).queuedActions.map((action) => action.kind), ["eat_food"]);
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline && adapters.get(botId)?.eatCount === 0) await delay(25);
      assert.equal(adapters.get(botId)?.eatCount, 1);
      const history = getCommandInvocationHistoryForDebug(registry, { botId });
      assert.equal(history[0]?.commandId, "interact.eat");
      assert.equal(history[0]?.source, "agent");
      assert.equal(history[0]?.status, "executed");
      const framework = await readFramework(botId);
      assert.ok(framework.recentEvents.some((event) =>
        event.type === "task_finished" && event.payload.skill === "interact.eat"
      ));
      assert.ok(framework.executionEvents.some((event) =>
        event.type === "task_finished" && event.payload.skill === "interact.eat"
      ));
    });
  } finally {
    stopActionRuntime();
    await server.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
});
