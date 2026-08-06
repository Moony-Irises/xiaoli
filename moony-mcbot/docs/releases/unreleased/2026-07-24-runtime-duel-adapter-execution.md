---
type: refactor
scope: runtime
audience: developer
summary: 将持续决斗的追击与攻击执行迁移到稳定实体 ID 的 ClientAdapter 动作
breaking: false
demo_ready: false
tests: npx tsx --test test/client-adapter-conformance.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - test/client-adapter-entity-actions.test.ts
  - test/client-adapter-status.test.ts
  - docs/modded-client-adapter-plan.md
  - docs/manual-testing-guide.md
---

## What changed

`ClientAdapter` now exposes `pursueEntity` and `attackEntity` actions keyed by a stable entity ID. Mineflayer resolves the requested entity at execution time, applies the safe pathfinder profile with a direct-movement fallback, validates attack range and performs the hit. The duel tick now reads only runtime snapshots and invokes these actions instead of accessing a native bot, entity table, pathfinder or attack method.

## Why it matters

A sustained duel can keep one target across ticks without silently switching to another nearby entity. Pursuit and hit attempts now appear in Adapter action history, while the future Modded Client implementation receives a concrete target-stability contract.

## Demo posture / limitations

This is an internal boundary refactor, not Modded Client support, an install demo, a published release or GA behavior. Only the Mineflayer adapter currently implements these actions, and the updated duel flow still needs the documented in-game regression pass.
