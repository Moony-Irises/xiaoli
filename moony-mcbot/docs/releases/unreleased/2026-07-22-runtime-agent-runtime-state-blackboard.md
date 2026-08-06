---
type: refactor
scope: runtime
audience: developer
summary: 将未持久化的 Agent runtimeState 迁移到黑板
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

The transient Agent `runtimeState` is now owned by the hierarchical blackboard. The configuration Map no longer stores or reports this runtime-only field; status, trace, state snapshots, and raw config status read the blackboard state instead.

## Why it matters

Configuration and runtime state now have a clearer boundary. Restart-persisted settings remain in `chat-configs.json`, while task-running, idle, social, and guarded state stays in the live Agent runtime and cannot be mistaken for persisted configuration.

## Demo posture / limitations

This does not change the persisted configuration schema or MCP tool names. Some derived state still considers active Mineflayer sessions and self-guard thresholds when building the detailed state snapshot; complete derived-state normalization remains future work.
