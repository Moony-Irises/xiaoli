---
type: refactor
scope: runtime
audience: developer
summary: 将固定坐标移动迁移到可测试决策与 ClientAdapter moveTo 动作
breaking: false
demo_ready: false
tests: npx tsx --test test/position-movement.test.ts test/client-adapter-conformance.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/position-movement.ts
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - test/position-movement.test.ts
  - test/client-adapter-entity-actions.test.ts
  - test/client-adapter-conformance.test.ts
  - test/client-adapter-status.test.ts
  - docs/manual-testing-guide.md
---

## What changed

Fixed-position arrival and movement thresholds now live in a pure `decidePositionMovement` function. `ClientAdapter` exposes a `move_to_position` capability and `moveTo` action; Mineflayer keeps safe pathfinder setup and direct control-state fallback inside its adapter. The legacy `goToPosition` orchestration now reads runtime snapshots, submits one adapter action per target, and stops through `BotRuntime`.

## Why it matters

High-level movement no longer reads Mineflayer positions or controls pathfinder/control-state directly. Another client implementation can provide the same coordinate movement contract, while boundary behavior and action evidence remain testable without connecting to Minecraft.

## Demo posture / limitations

The MCP and Web action inputs, 200ms arrival checks, stop radius and task lifecycle remain compatible. This is an internal refactor, not a Modded Client implementation, install demo, published release or GA behavior. Real pathfinding, cancellation and obstacle behavior still require the documented in-game regression; mining and container-wait movement remain on native Mineflayer paths.
