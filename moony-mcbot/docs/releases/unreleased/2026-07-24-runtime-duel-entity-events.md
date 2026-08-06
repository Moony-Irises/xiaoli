---
type: refactor
scope: runtime
audience: developer
summary: 将持续决斗的实体死亡与自身死亡监听迁移到 ClientAdapter 事件边界
breaking: false
demo_ready: false
tests: npx tsx --test test/client-adapter-conformance.test.ts test/client-adapter-entity-events.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - test/client-adapter-entity-events.test.ts
  - test/client-adapter-status.test.ts
  - docs/manual-testing-guide.md
---

## What changed

`ClientAdapter` now exposes normalized `entity_dead` and `self_death` subscriptions. `MineflayerAdapter` maps native events into snapshots and clears every subscription during disconnect or client-reference cleanup. Sustained duel sessions now retain only an unsubscribe callback instead of a native Mineflayer bot handle and event callbacks.

## Why it matters

Duel lifecycle handling no longer reaches through the runtime into Mineflayer's event emitter. The subscription and cleanup contract is testable offline, prevents stale listeners from surviving reconnects, and gives a future Modded Client adapter a concrete event boundary to implement.

## Demo posture / limitations

This is an internal refactor, not a complete Modded Client duel implementation, install demo, published release or GA feature. Pathfinder pursuit and repeated hit execution are still Mineflayer-specific and require the existing in-game regression test.
