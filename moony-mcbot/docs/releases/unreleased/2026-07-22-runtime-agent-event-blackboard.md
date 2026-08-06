---
type: refactor
scope: runtime
audience: developer
summary: 将 Agent 执行事件遥测迁移到黑板统一管理
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

Agent execution telemetry no longer uses the `agentRecentEvents` Map in `action-tools.ts`. The blackboard now owns a bounded `executionEvents` stream, while `agent.events.tail`, `agent.trace.summary`, state snapshots, and event counts expose the same records and preserve their existing JSON fields.

## Why it matters

Task progress, goal lifecycle, planner enqueueing, and action failures now have one runtime owner for their observable execution history. This prevents the hierarchical runtime and legacy tool layer from silently reporting different recent-event sequences.

## Demo posture / limitations

The framework `recentEvents` stream and execution telemetry remain separate typed views inside the same blackboard because Reactive rules consume normalized framework events while debug tools need the existing execution-event payload shape. Configuration and chat-memory compatibility mirrors are still separate and are not changed here.
