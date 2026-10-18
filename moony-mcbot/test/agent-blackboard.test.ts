import assert from "node:assert/strict";
import test from "node:test";
import { AgentBlackboard } from "../src/agent/blackboard.js";
import {
  HierarchicalAgentRuntime,
  HierarchicalAgentSupervisor
} from "../src/agent/runtime.js";

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

test("runtime snapshot merges framework events into the observable execution stream", () => {
  const runtime = new HierarchicalAgentRuntime("observable-events-test");
  runtime.ingestEvent({
    id: "planner_requested_1",
    type: "planner_requested",
    priority: "normal",
    createdAt: 1_000,
    payload: { instruction: "follow Judy" }
  });
  runtime.ingestEvent({
    id: "perception_1",
    type: "perception_updated",
    priority: "low",
    createdAt: 1_100,
    payload: {}
  });
  runtime.blackboard.recordExecutionEvent({
    id: "planner_result_1",
    timestamp: new Date(1_200).toISOString(),
    type: "planner_result",
    priority: "normal",
    payload: { intent: "no_action" }
  });

  const snapshot = runtime.snapshot();

  assert.deepEqual(snapshot.executionEvents.map((event) => event.type), [
    "planner_requested",
    "planner_result"
  ]);
  assert.equal(snapshot.executionEvents.some((event) => event.type === "perception_updated"), false);
  assert.equal(snapshot.recentEvents.length, 2);
});

test("runtime keeps observable evidence through polling noise and clock rollback", () => {
  const runtime = new HierarchicalAgentRuntime("observable-polling-test");
  runtime.ingestEvent({
    id: "planner_requested", type: "planner_requested", priority: "normal",
    createdAt: 2_000, payload: { detail: "planning" }
  });
  runtime.blackboard.recordExecutionEvent({
    id: "task_started", type: "task_started", priority: "normal",
    timestamp: new Date(1_000).toISOString(), payload: { detail: "executing" }
  });
  for (let index = 0; index < 100; index += 1) {
    runtime.updatePerception({ index });
    runtime.ingestEvent({
      id: `tick_${index}`, type: "tick", priority: "low",
      createdAt: 3_000 + index, payload: {}
    });
    runtime.snapshot();
  }
  assert.deepEqual(runtime.snapshot().executionEvents.map((event) => event.id), [
    "planner_requested", "task_started"
  ]);
  assert.equal(runtime.snapshot().recentEvents.length, 64);
  assert.deepEqual(runtime.rawExecutionEvents().map((event) => event.id), ["task_started"]);
  assert.equal(runtime.status().recentExecutionEvents, 2);
});

test("runtime bounds and isolates observable events while deduplicating shared IDs", () => {
  const first = new HierarchicalAgentRuntime("observable-first");
  const second = new HierarchicalAgentRuntime("observable-second");
  const payload = { detail: "original" };
  first.blackboard.recordExecutionEvent({
    id: "shared", type: "task_finished", priority: "normal",
    timestamp: new Date(1).toISOString(), payload
  });
  first.ingestEvent({
    id: "shared", type: "task_finished", priority: "normal", createdAt: 2,
    payload: { detail: "framework mirror" }
  });
  payload.detail = "changed outside";
  const copy = first.snapshot().executionEvents;
  assert.equal(copy.length, 1);
  assert.equal(copy[0]?.payload.detail, "original");
  copy[0]!.payload.detail = "changed snapshot";
  assert.equal(first.snapshot().executionEvents[0]?.payload.detail, "original");

  for (let index = 0; index < 21; index += 1) {
    if (index % 2 === 0) {
      first.ingestEvent({
        id: `event_${index}`, type: "planner_result", priority: "normal",
        createdAt: 10, payload: { index }
      });
    } else {
      first.blackboard.recordExecutionEvent({
        id: `event_${index}`, type: "step_executed", priority: "normal",
        timestamp: new Date(10).toISOString(), payload: { index }
      });
    }
  }
  assert.deepEqual(first.snapshot().executionEvents.map((event) => event.id),
    Array.from({ length: 20 }, (_, index) => `event_${index + 1}`));
  assert.deepEqual(second.snapshot().executionEvents, []);
});

test("hierarchical runtime owns one replaceable task timeout", () => {
  const runtime = new HierarchicalAgentRuntime("agent-timer-test");

  assert.equal(runtime.scheduleTaskTimeout("follow_player", 1_000, 10_000), "task_timeout_agent-timer-test");
  assert.deepEqual(runtime.snapshot().timers, [
    {
      id: "task_timeout_agent-timer-test",
      type: "timeout",
      label: "follow_player",
      dueAt: 11_000,
      payload: { taskType: "follow_player" }
    }
  ]);

  runtime.scheduleTaskTimeout("duel", 500, 12_000);
  assert.equal(runtime.snapshot().timers.length, 1);
  assert.equal(runtime.snapshot().timers[0]?.label, "duel");
  assert.deepEqual(runtime.pollExpiredTimers(12_499), []);
  assert.equal(runtime.pollExpiredTimers(12_500)[0]?.type, "task_timeout");

  runtime.scheduleTaskTimeout("move_to_position", 1_000, 20_000);
  runtime.clearTaskTimeout();
  assert.deepEqual(runtime.snapshot().timers, []);
  assert.deepEqual(runtime.pollExpiredTimers(21_000), []);
});

test("hierarchical runtime preserves the executor tick cooldown boundary", () => {
  const runtime = new HierarchicalAgentRuntime("agent-tick-test");

  assert.equal(runtime.shouldPublishTick(10_000, 5_000), true);
  assert.equal(runtime.shouldPublishTick(14_999, 5_000), false);
  assert.equal(runtime.shouldPublishTick(15_000, 5_000), true);
  assert.equal(runtime.shouldPublishTick(14_000, 5_000), false);
});

test("hierarchical runtime owns planner cooldown and does not rewind from stale config diagnostics", () => {
  const runtime = new HierarchicalAgentRuntime("agent-planner-cooldown-test");

  assert.equal(runtime.canStartPlanner(10_000, 4_000), true);
  runtime.syncPlannerTimestamp(10_000);
  assert.equal(runtime.canStartPlanner(13_999, 4_000), false);
  assert.equal(runtime.plannerCooldownRemaining(13_999, 4_000), 1);
  assert.equal(runtime.canStartPlanner(14_000, 4_000), true);

  assert.equal(runtime.markPlannerCompleted(14_000), 14_000);
  runtime.syncPlannerTimestamp(12_000);
  assert.equal(runtime.markPlannerCompleted(13_000), 14_000);
  assert.equal(runtime.plannerCooldownRemaining(15_000, 4_000), 3_000);
  assert.equal(runtime.canStartPlanner(13_000, 4_000), false);

  runtime.syncPlannerTimestamp(Number.NaN);
  assert.equal(runtime.plannerCooldownRemaining(18_000, 4_000), 0);
});

test("hierarchical runtime preserves task progress throttle boundaries", () => {
  const runtime = new HierarchicalAgentRuntime("agent-task-progress-test");

  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 100, 1_200), true);
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 100, 1_200), true);

  runtime.markTaskProgressPublished("task_1", "moving", 100);
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 1_299, 1_200), false);
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 1_300, 1_200), true);
  assert.equal(runtime.canPublishTaskProgress("task_1", "digging", 101, 1_200), true);
  assert.equal(runtime.canPublishTaskProgress("task_2", "moving", 101, 1_200), true);
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 50, 1_200), false);

  runtime.clearTaskProgress();
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 101, 1_200), true);
});

test("hierarchical supervisor clears task progress without creating missing runtimes", () => {
  const supervisor = new HierarchicalAgentSupervisor();

  assert.equal(supervisor.clearTaskProgress("missing"), false);
  assert.deepEqual(supervisor.listBotIds(), []);

  const runtime = supervisor.ensure("bot-a");
  runtime.markTaskProgressPublished("task_1", "moving", 100);
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 200, 1_200), false);
  assert.equal(supervisor.clearTaskProgress("bot-a"), true);
  assert.equal(runtime.canPublishTaskProgress("task_1", "moving", 200, 1_200), true);
});

test("hierarchical runtime keeps strategic lifecycle instruction and report state independent", () => {
  const runtime = new HierarchicalAgentRuntime("agent-strategic-lifecycle-test");

  assert.equal(runtime.claimStrategicLifecycleInstruction("event_1"), true);
  assert.equal(runtime.claimStrategicLifecycleInstruction("event_1"), false);
  assert.equal(runtime.claimStrategicLifecycleInstruction("event_2"), true);

  assert.equal(runtime.canPublishStrategicLifecycleReport("event_1"), true);
  assert.equal(runtime.canPublishStrategicLifecycleReport("event_1"), true);
  runtime.markStrategicLifecycleReportPublished("event_1");
  assert.equal(runtime.canPublishStrategicLifecycleReport("event_1"), false);
  assert.equal(runtime.canPublishStrategicLifecycleReport("event_2"), true);
  assert.equal(runtime.claimStrategicLifecycleInstruction("event_2"), false);

  runtime.clearStrategicLifecycle();
  assert.equal(runtime.claimStrategicLifecycleInstruction("event_2"), true);
  assert.equal(runtime.canPublishStrategicLifecycleReport("event_1"), true);
});

test("hierarchical supervisor clears strategic lifecycle state without creating missing runtimes", () => {
  const supervisor = new HierarchicalAgentSupervisor();

  assert.equal(supervisor.clearStrategicLifecycle("missing"), false);
  assert.deepEqual(supervisor.listBotIds(), []);

  const runtime = supervisor.ensure("bot-a");
  runtime.claimStrategicLifecycleInstruction("event_1");
  runtime.markStrategicLifecycleReportPublished("event_1");
  assert.equal(supervisor.clearStrategicLifecycle("bot-a"), true);
  assert.equal(runtime.claimStrategicLifecycleInstruction("event_1"), true);
  assert.equal(runtime.canPublishStrategicLifecycleReport("event_1"), true);
});

test("hierarchical runtime owns the Agent inventory event baseline", () => {
  const runtime = new HierarchicalAgentRuntime("agent-inventory-baseline-test");

  assert.equal(runtime.observeInventorySummary("empty"), false);
  assert.equal(runtime.observeInventorySummary("empty"), false);
  assert.equal(runtime.observeInventorySummary("coal:1"), true);
  assert.equal(runtime.observeInventorySummary("coal:1"), false);
  assert.equal(runtime.observeInventorySummary("empty"), true);

  runtime.clearInventorySummary();
  assert.equal(runtime.observeInventorySummary("empty"), false);
});

test("hierarchical supervisor clears the inventory baseline without creating missing runtimes", () => {
  const supervisor = new HierarchicalAgentSupervisor();

  assert.equal(supervisor.clearInventorySummary("missing"), false);
  assert.deepEqual(supervisor.listBotIds(), []);

  const runtime = supervisor.ensure("bot-a");
  runtime.observeInventorySummary("empty");
  assert.equal(runtime.observeInventorySummary("coal:1"), true);
  assert.equal(supervisor.clearInventorySummary("bot-a"), true);
  assert.equal(runtime.observeInventorySummary("coal:1"), false);
});

test("hierarchical runtime owns the Agent idle social attempt cooldown", () => {
  const runtime = new HierarchicalAgentRuntime("agent-idle-social-cooldown-test");

  assert.equal(runtime.claimIdleSocialAttempt(19_999, 20_000), false);
  assert.equal(runtime.claimIdleSocialAttempt(20_000, 20_000), true);
  assert.equal(runtime.claimIdleSocialAttempt(20_001, 20_000), false);
  assert.equal(runtime.claimIdleSocialAttempt(19_999, 20_000), false);
  assert.equal(runtime.claimIdleSocialAttempt(40_000, 20_000), true);
  assert.equal(runtime.claimIdleSocialAttempt(40_001, 20_000), false);

  runtime.clearIdleSocialAttempt();
  assert.equal(runtime.claimIdleSocialAttempt(20_000, 20_000), true);
});

test("hierarchical supervisor clears idle social cooldown without creating missing runtimes", () => {
  const supervisor = new HierarchicalAgentSupervisor();

  assert.equal(supervisor.clearIdleSocialAttempt("missing"), false);
  assert.deepEqual(supervisor.listBotIds(), []);

  const runtime = supervisor.ensure("bot-a");
  assert.equal(runtime.claimIdleSocialAttempt(20_000, 20_000), true);
  assert.equal(runtime.claimIdleSocialAttempt(20_001, 20_000), false);
  assert.equal(supervisor.clearIdleSocialAttempt("bot-a"), true);
  assert.equal(runtime.claimIdleSocialAttempt(20_001, 20_000), true);
});
