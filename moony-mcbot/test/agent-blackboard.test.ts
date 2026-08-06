import assert from "node:assert/strict";
import test from "node:test";
import { AgentBlackboard } from "../src/agent/blackboard.js";
import { HierarchicalAgentRuntime } from "../src/agent/runtime.js";

test("blackboard owns strategic goal, milestone, and active task state", () => {
  const runtime = new HierarchicalAgentRuntime("blackboard-test");
  const goal = {
    goal: "Follow Judy",
    rationale: "test",
    source: "manual" as const,
    milestones: ["Start following Judy", "Maintain proximity"],
    currentMilestoneIndex: 1,
    createdAt: 1,
    updatedAt: 2
  };
  const task = {
    taskId: "task_1",
    type: "follow_player",
    status: "running" as const,
    source: "manual_command" as const,
    goal: "Follow Judy",
    params: { playerName: "Judy" },
    createdAt: 3,
    updatedAt: 4
  };

  runtime.blackboard.setStrategicGoal(goal);
  runtime.blackboard.setActiveTask(task);
  runtime.blackboard.setRuntimeState("task_running");

  const snapshot = runtime.snapshot();
  assert.equal(snapshot.runtimeState, "task_running");
  assert.deepEqual(snapshot.strategicGoal, goal);
  assert.deepEqual(snapshot.activeTask, task);
  assert.equal(runtime.status().currentMilestone, "Maintain proximity");
  assert.deepEqual(runtime.status().activeTask, task);

  goal.milestones[1] = "mutated outside blackboard";
  task.params.playerName = "mutated outside blackboard";
  assert.equal(runtime.snapshot().strategicGoal?.milestones?.[1], "Maintain proximity");
  assert.equal(runtime.snapshot().activeTask?.params.playerName, "Judy");
});

test("blackboard clears goal and task without disturbing its action queue", () => {
  const blackboard = new AgentBlackboard("blackboard-clear-test");
  blackboard.setStrategicGoal({
    goal: "Test",
    source: "manual",
    createdAt: 1,
    updatedAt: 1
  });
  blackboard.setActiveTask({
    taskId: "task_1",
    type: "test",
    status: "running",
    source: "runtime",
    goal: "Test",
    params: {},
    createdAt: 1,
    updatedAt: 1
  });
  blackboard.enqueueActions([
    {
      id: "action_1",
      kind: "tool_call",
      params: { tool: "chat.send", arguments: { message: "test" } },
      source: "llm",
      priority: "normal",
      createdAt: 1
    }
  ]);
  blackboard.setStrategicGoal(null);
  blackboard.setActiveTask(null);

  const snapshot = blackboard.snapshot();
  assert.equal(snapshot.strategicGoal, null);
  assert.equal(snapshot.activeTask, null);
  assert.equal(snapshot.queuedActions[0]?.kind, "tool_call");
  assert.equal(snapshot.queuedActions[0]?.params.tool, "chat.send");
});

test("blackboard keeps a bounded execution event stream with isolated payloads", () => {
  const blackboard = new AgentBlackboard("blackboard-events-test");
  const payload = { detail: "first" };

  blackboard.recordExecutionEvent({
    id: "event_1",
    timestamp: new Date(1).toISOString(),
    type: "task_started",
    priority: "normal",
    payload
  });
  payload.detail = "mutated outside blackboard";
  assert.equal(blackboard.snapshot().executionEvents[0]?.payload.detail, "first");
  for (let index = 2; index <= 21; index += 1) {
    blackboard.recordExecutionEvent({
      id: `event_${index}`,
      timestamp: new Date(index).toISOString(),
      type: "task_progress",
      priority: "normal",
      payload: { index }
    });
  }

  const snapshot = blackboard.snapshot();
  assert.equal(snapshot.executionEvents.length, 20);
  assert.equal(snapshot.executionEvents[0]?.id, "event_2");
  assert.equal(snapshot.executionEvents.at(-1)?.id, "event_21");
  const firstEvent = snapshot.executionEvents[0];
  assert.equal(firstEvent?.payload.index, 2);
});
