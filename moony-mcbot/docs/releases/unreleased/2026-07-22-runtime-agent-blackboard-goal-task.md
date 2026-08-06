---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 的战略目标、里程碑和活动任务状态收口到黑板
breaking: false
demo_ready: false
tests: npm run typecheck; npm test; git diff --check
artifacts:
  - src/agent/types.ts
  - src/agent/blackboard.ts
  - src/agent/runtime.ts
  - src/tools/action-tools.ts
  - test/agent-blackboard.test.ts
---

## What changed

Agent blackboard now owns the strategic goal, current milestone, active task snapshot, and planner tool-call queue. Goal/task lifecycle writes and debug/status reads in `action-tools.ts` use the hierarchical runtime blackboard instead of separate goal/task/plan-step Maps. Legacy planner steps are wrapped as `tool_call` actions, while `queuedLegacySteps` and `queuedStepCount` remain compatible projections.

## Why it matters

The Web panel, MCP status tools, and hierarchical runtime can now observe the same goal/task/action-queue state instead of merging independent stores. This reduces stale status after goal changes, task completion, task cancellation, or planner enqueueing and establishes the main execution-state boundary for the Agent single-source-of-truth plan.

## Demo posture / limitations

This is an internal convergence step, not a complete removal of every compatibility mirror. Recent event history, persisted configuration, and some runtime activity caches remain separate by design. No Minecraft behavior or external MCP tool name changes are implied.
