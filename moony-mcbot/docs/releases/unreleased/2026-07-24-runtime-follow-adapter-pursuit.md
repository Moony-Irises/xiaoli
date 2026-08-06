---
type: refactor
scope: runtime
audience: developer
summary: 将 follow 主循环迁移到快照距离决策和稳定玩家实体 ID 的 Adapter 追击
breaking: false
demo_ready: false
tests: npx tsx --test test/follow-session.test.ts test/client-adapter-entity-actions.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/follow-session.ts
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/tools/action-tools.ts
  - test/follow-session.test.ts
  - test/client-adapter-entity-actions.test.ts
  - docs/manual-testing-guide.md
---

## What changed

Follow distance handling now uses a pure `decideFollowMovement` function for missing target, out-of-range, approach and hold states. The follow tick reads runtime snapshots and calls `pursueEntity` with the player's stable entity ID instead of accessing a native bot, pathfinder or control states. The direct-movement fallback accepts an optional vertical jump hint, while normal pathfinder pursuit clears manual jumping.

## Why it matters

Follow orchestration is now portable to another client adapter and its distance boundaries are testable without Minecraft. Pursuit commands are issued only when the target crosses a block boundary, and stop commands are not repeated every tick, keeping Adapter action history useful.

## Demo posture / limitations

This preserves target-loss gestures, stationary-target timeout, min/max distance behavior and safe pathfinder policy. It is an internal refactor, not Modded Client support, an install demo, a published release or GA behavior, and it still needs the documented in-game follow regression pass.
