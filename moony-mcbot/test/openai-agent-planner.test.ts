import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenAiAgentPlanner,
  type AgentPlanRequest
} from "../src/agent/openai-agent-planner.js";
import { AiRequestError } from "../src/runtime/ai-request.js";
import type { OpenAiChatCompletionsRequest } from "../src/runtime/openai-compatible-client.js";

function request(overrides: Partial<AgentPlanRequest> = {}): AgentPlanRequest {
  return {
    config: {
      plannerApiBaseUrl: "https://example.test/v1",
      plannerApiKey: "test-key",
      plannerModel: "test-model",
      plannerSystemPrompt: "Return JSON.",
      allowedTools: ["move.stopFollow", "interact.eat"]
    },
    userInstruction: "Eat something.",
    stateSnapshot: {},
    timeoutMs: 1900,
    ...overrides
  };
}

function response(rawBody: string, status = 200) {
  return { endpoint: "https://example.test/v1/chat/completions", response: new Response(rawBody, { status }), rawBody };
}

function choice(content: unknown): string {
  return JSON.stringify({ choices: [{ message: { content } }] });
}

test("planner sends the existing prompts and filtered context through the injected transport", async () => {
  const controller = new AbortController();
  const snapshot = {
    botId: "private-bot", mode: "assist", unknown: "private-extra",
    selfState: { position: { x: 987, y: 654, z: 321 }, vitals: { food: 8 } },
    memorySummary: { owner: "Judy", memory: { playerProfiles: [{ playerName: "Judy", alias: "茉莉", notes: "private-note" }] } }
  };
  const before = JSON.stringify(snapshot);
  let captured: OpenAiChatCompletionsRequest | undefined;
  const planner = new OpenAiAgentPlanner(async (input) => {
    captured = input;
    return response(choice('{"intent":"no_action"}'));
  });
  assert.deepEqual(await planner.plan(request({ stateSnapshot: snapshot, signal: controller.signal })), { intent: "no_action" });
  assert.ok(captured);
  assert.equal(captured.signal, controller.signal);
  assert.equal(captured.timeoutMs, 1900);
  assert.equal(captured.apiBaseUrl, "https://example.test/v1");
  assert.equal(captured.apiKey, "test-key");
  const body = captured.body as { model: string; temperature: number; messages: { role: string; content: string }[] };
  assert.equal(body.model, "test-model");
  assert.equal(body.temperature, 0.2);
  assert.equal(body.messages.length, 15);
  assert.deepEqual(body.messages[0], { role: "system", content: "Return JSON." });
  assert.match(body.messages[1]?.content ?? "", /允许工具:\nmove\.stopFollow\ninteract\.eat/);
  assert.equal(body.messages.filter((message) => /^示例\d+:/.test(message.content)).length, 10);
  assert.match(body.messages[12]?.content ?? "", /alias=茉莉/);
  const projection = JSON.parse(body.messages[13]!.content.split("\n").slice(1).join("\n")) as { self: { vitals: { food: number } } };
  assert.equal(projection.self.vitals.food, 8);
  assert.doesNotMatch(JSON.stringify(body), /private-bot|private-extra|private-note|987|654|321|完整状态JSON/);
  assert.deepEqual(body.messages.at(-1), { role: "user", content: "Eat something." });
  assert.equal(JSON.stringify(snapshot), before);
});

test("planner rejects a missing key before sending any request", async () => {
  let calls = 0;
  const planner = new OpenAiAgentPlanner(async () => {
    calls += 1;
    return response(choice('{"intent":"no_action"}'));
  });
  const input = request();
  input.config.plannerApiKey = "";
  await assert.rejects(planner.plan(input), /Agent planner API key is empty/);
  assert.equal(calls, 0);
});

test("planner preserves directive, legacy steps and both supported intents", async () => {
  const plans = [
    { intent: "no_action" },
    { intent: "execute_skill", tool: "interact.eat", arguments: { itemName: "bread" }, steps: [{ tool: "move.stopFollow" }] },
    { intent: "execute_skill", directive: { goal: "Recover", milestones: ["Eat"], currentMilestoneIndex: 0, actions: [{ kind: "eat_food", params: {} }] } }
  ];
  for (const plan of plans) {
    const planner = new OpenAiAgentPlanner(async () => response(choice(JSON.stringify(plan))));
    assert.deepEqual(await planner.plan(request()), plan);
  }
});

test("planner accepts content parts, fenced JSON and choice text fallback", async () => {
  for (const rawBody of [
    choice('  ```json\n{"intent":"no_action"}\n```  '),
    choice(["{", { text: '"intent":' }, { content: '"no_action"' }, null, 5, {}, "}"]),
    JSON.stringify({ choices: [{ message: { content: [] }, text: '{"intent":"no_action"}' }] })
  ]) {
    const planner = new OpenAiAgentPlanner(async () => response(rawBody));
    assert.deepEqual(await planner.plan(request()), { intent: "no_action" });
  }
});

test("planner reports empty first choices without exposing reasoning text", async () => {
  const diagnostics = [
    [JSON.stringify({ choices: [] }), /choice=missing/],
    [JSON.stringify({ choices: [{ message: { content: 42 }, finish_reason: "stop" }] }), /content_type=number/],
    [JSON.stringify({ choices: [{ message: { content: null, reasoning_content: "private-reasoning" }, finish_reason: "length" }] }), /has_reasoning_content=true/],
    [JSON.stringify({ choices: [{ message: { content: "" } }, { message: { content: '{"intent":"no_action"}' } }] }), /returned empty content/]
  ] as const;
  for (const [rawBody, diagnostic] of diagnostics) {
    const planner = new OpenAiAgentPlanner(async () => response(rawBody));
    await assert.rejects(planner.plan(request()), (error: Error) => {
      assert.match(error.message, /Agent planner returned empty content/);
      assert.match(error.message, diagnostic);
      assert.doesNotMatch(error.message, /private-reasoning/);
      return true;
    });
  }
});

test("planner preserves HTTP failure text and the 200 character response excerpt", async () => {
  const rawBody = "a".repeat(200) + "hidden-tail";
  const planner = new OpenAiAgentPlanner(async () => response(rawBody, 429));
  await assert.rejects(planner.plan(request()), { message: `Agent planner request failed: HTTP 429 ${"a".repeat(200)}` });
});

test("planner rejects malformed outer JSON, malformed plans and unsupported intents", async () => {
  for (const rawBody of ["not json", choice("not json"), choice('{"intent":"invented"}')]) {
    const planner = new OpenAiAgentPlanner(async () => response(rawBody));
    await assert.rejects(planner.plan(request()), /JSON|Unexpected token|invalid intent/);
  }
});

test("planner propagates timeout, cancellation and transport errors without retry", async () => {
  for (const error of [new AiRequestError("timeout", "timed out"), new AiRequestError("cancelled", "cancelled"), new Error("network failed")]) {
    let calls = 0;
    const planner = new OpenAiAgentPlanner(async () => {
      calls += 1;
      throw error;
    });
    await assert.rejects(planner.plan(request()), (actual) => actual === error);
    assert.equal(calls, 1);
  }
});

test("one planner keeps simultaneous requests and per-request configuration independent", async () => {
  const planner = new OpenAiAgentPlanner(async (input) => {
    const body = input.body as { model: string };
    return response(choice(JSON.stringify({ intent: "no_action", speak: body.model })));
  });
  const first = request();
  const second = request();
  second.config.plannerModel = "second-model";
  const [a, b] = await Promise.all([planner.plan(first), planner.plan(second)]);
  assert.equal(a.speak, "test-model");
  assert.equal(b.speak, "second-model");
});
