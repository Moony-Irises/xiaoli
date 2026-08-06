---
type: refactor
scope: runtime
audience: developer
summary: 将低风险 Agent 工具调用迁移到统一 Adapter 入口
breaking: false
demo_ready: false
tests: npm run typecheck; npm test; git diff --check
artifacts:
  - src/tools/action-tools.ts
  - test/client-adapter-conformance.test.ts
  - docs/architecture-convergence-roadmap.md
---

## What changed

Agent tool execution now delays Mineflayer-specific access until legacy world operations require it. Observation, chat sending, inventory category holding, door interaction, dropping items, nearby-player memory capture, and self-guard status use `BotRuntime` adapter-backed snapshots or actions.

## Why it matters

These common tools can now run against a future Client Adapter without requiring a native Mineflayer bot handle first. The migration also makes the remaining Mineflayer-only surface explicit instead of hiding it behind an unconditional getter at the top of the executor.

## Demo posture / limitations

This is a partial action-tools migration. Verified Mineflayer-specific code remains for chat echo verification, pathfinding, visible mining, combat loops, idle perception, and first-person focus. No new Modded Client behavior is implied.
