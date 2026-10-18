import assert from "node:assert/strict";
import test from "node:test";
import { AiRequestError } from "../src/runtime/ai-request.js";
import { AiRequestLifecycle } from "../src/runtime/ai-request-lifecycle.js";
import { runAgentPlannerRequest } from "../src/agent/planner-request-runner.js";
import type { AiRequestStatus } from "../src/runtime/ai-request.js";
import type { AgentPlan, AgentPlanRequester } from "../src/agent/openai-agent-planner.js";

const config = {
  plannerApiBaseUrl: "https://planner.invalid/v1",
  plannerApiKey: "test-key",
  plannerModel: "test-model",
  plannerSystemPrompt: "return JSON",
  allowedTools: ["chat.send"]
};

function deferredPlan(): { promise: Promise<AgentPlan>; resolve: (plan: AgentPlan) => void } {
  let resolvePromise: ((plan: AgentPlan) => void) | undefined;
  const promise = new Promise<AgentPlan>((resolve) => { resolvePromise = resolve; });
  return {
    promise,
    resolve: (plan) => {
      assert.ok(resolvePromise);
      resolvePromise(plan);
    }
  };
}

function createRequestFixture(): {
  lifecycle: AiRequestLifecycle;
  writes: Array<{ botId: string; status: AiRequestStatus }>;
  start: (botId: string, requester: AgentPlanRequester) => Promise<AgentPlan>;
} {
  const writes: Array<{ botId: string; status: AiRequestStatus }> = [];
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (botId, status) => {
      writes.push({ botId, status });
      return true;
    }
  });
  return {
    lifecycle,
    writes,
    start: (botId, requester) => runAgentPlannerRequest({
      botId, config, userInstruction: "wait", stateSnapshot: {}, timeoutMs: 1200, requester, lifecycle
    })
  };
}

test("runAgentPlannerRequest forwards input and records success", async () => {
  const statuses: string[] = [];
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (_botId, status) => {
      statuses.push(status.state);
      return true;
    }
  });
  let receivedSignal: AbortSignal | undefined;

  const plan = await runAgentPlannerRequest({
    botId: "bot",
    config,
    userInstruction: "say hi",
    stateSnapshot: { runtimeState: "idle" },
    timeoutMs: 1200,
    lifecycle,
    requester: {
      async plan(request) {
        receivedSignal = request.signal;
        assert.equal(request.userInstruction, "say hi");
        assert.deepEqual(request.stateSnapshot, { runtimeState: "idle" });
        assert.equal(request.timeoutMs, 1200);
        assert.equal(request.config, config);
        return { intent: "no_action", speak: "hi" };
      }
    }
  });

  assert.deepEqual(plan, { intent: "no_action", speak: "hi" });
  assert.ok(receivedSignal);
  assert.deepEqual(statuses, ["running", "success"]);
  assert.equal(lifecycle.hasActive("bot"), false);
});

test("runAgentPlannerRequest records classified failures and rethrows", async () => {
  const statuses: Array<{ state: string; error?: string }> = [];
  const lifecycle = new AiRequestLifecycle({
    writeStatus: (_botId, status) => {
      statuses.push(status);
      return true;
    }
  });
  const error = new AiRequestError("cancelled", "request was cancelled");

  await assert.rejects(
    runAgentPlannerRequest({
      botId: "bot",
      config,
      userInstruction: "stop",
      stateSnapshot: {},
      timeoutMs: 1200,
      lifecycle,
      requester: { plan: async () => { throw error; } }
    }),
    error
  );

  assert.equal(statuses[0]?.state, "running");
  assert.equal(statuses[1]?.state, "cancelled");
  assert.equal(statuses[1]?.error, "request was cancelled");
  assert.equal(lifecycle.hasActive("bot"), false);
});

test("planner request failures preserve timeout and ordinary error identity", async () => {
  for (const [error, state] of [
    [new AiRequestError("timeout", "planner timed out"), "timeout"],
    [new Error("upstream unavailable"), "failed"],
    ["transport rejected", "failed"]
  ] as const) {
    const fixture = createRequestFixture();
    await assert.rejects(
      fixture.start("bot", { plan: async () => { throw error; } }),
      (actual: unknown) => actual === error
    );
    const status = fixture.writes.at(-1)?.status;
    assert.equal(status?.state, state);
    assert.equal(status?.error, error instanceof Error ? error.message : error);
    assert.equal(status?.model, "test-model");
    assert.equal(status?.timeoutMs, 1200);
    assert.ok(status?.startedAt);
    assert.ok(status?.finishedAt);
    assert.equal(fixture.lifecycle.hasActive("bot"), false);
  }
});

test("cancelling an active planner request reaches its signal and records the terminal state", async () => {
  const fixture = createRequestFixture();
  const cancelled = new AiRequestError("cancelled", "cancelled by user");
  let signal: AbortSignal | undefined;
  const request = fixture.start("bot", {
    plan: (input) => new Promise<AgentPlan>((_resolve, reject) => {
      signal = input.signal;
      assert.ok(signal);
      signal.addEventListener("abort", () => reject(cancelled), { once: true });
    })
  });
  const rejected = assert.rejects(request, (actual: unknown) => actual === cancelled);

  assert.equal(fixture.lifecycle.cancel("bot"), true);
  assert.equal(signal?.aborted, true);
  await rejected;
  assert.deepEqual(fixture.writes.map(({ status }) => status.state), ["running", "cancelled"]);
  assert.equal(fixture.lifecycle.hasActive("bot"), false);
});

test("invalidating a planner request blocks late diagnostics even if the requester ignores abort", async () => {
  const fixture = createRequestFixture();
  const gate = deferredPlan();
  let signal: AbortSignal | undefined;
  const request = fixture.start("bot", {
    plan: async (input) => { signal = input.signal; return gate.promise; }
  });

  assert.equal(fixture.lifecycle.invalidate("bot"), true);
  assert.equal(signal?.aborted, true);
  const plan: AgentPlan = { intent: "no_action" };
  gate.resolve(plan);
  assert.strictEqual(await request, plan);
  assert.deepEqual(fixture.writes.map(({ status }) => status.state), ["running"]);
  assert.equal(fixture.lifecycle.hasActive("bot"), false);
});

test("an older planner completion cannot overwrite or close the newer request", async () => {
  const fixture = createRequestFixture();
  const first = deferredPlan();
  const second = deferredPlan();
  let firstSignal: AbortSignal | undefined;
  const older = fixture.start("bot", {
    plan: async (input) => { firstSignal = input.signal; return first.promise; }
  });
  const newer = fixture.start("bot", { plan: async () => second.promise });

  first.resolve({ intent: "no_action" });
  await older;
  assert.equal(firstSignal?.aborted, false);
  assert.equal(fixture.lifecycle.hasActive("bot"), true);
  assert.deepEqual(fixture.writes.map(({ status }) => status.state), ["running", "running"]);

  second.resolve({ intent: "no_action" });
  await newer;
  assert.deepEqual(fixture.writes.map(({ status }) => status.state), ["running", "running", "success"]);
  assert.equal(fixture.lifecycle.hasActive("bot"), false);
});

test("invalidating one bot leaves another bot planner request active", async () => {
  const fixture = createRequestFixture();
  const first = deferredPlan();
  const second = deferredPlan();
  const requestA = fixture.start("bot-a", { plan: async () => first.promise });
  const requestB = fixture.start("bot-b", { plan: async () => second.promise });

  assert.equal(fixture.lifecycle.invalidate("bot-a"), true);
  assert.equal(fixture.lifecycle.hasActive("bot-b"), true);
  first.resolve({ intent: "no_action" });
  second.resolve({ intent: "no_action" });
  await Promise.all([requestA, requestB]);
  assert.deepEqual(fixture.writes.map(({ botId, status }) => [botId, status.state]), [
    ["bot-a", "running"], ["bot-b", "running"], ["bot-b", "success"]
  ]);
  assert.equal(fixture.lifecycle.hasActive("bot-a"), false);
  assert.equal(fixture.lifecycle.hasActive("bot-b"), false);
});
