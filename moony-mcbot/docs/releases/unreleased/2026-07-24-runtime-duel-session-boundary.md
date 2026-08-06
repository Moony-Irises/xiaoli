---
type: refactor
scope: runtime
audience: developer
summary: 将持续挑战的目标匹配和 tick 决策抽成快照驱动的纯运行时逻辑
breaking: false
demo_ready: false
tests: npx tsx --test test/duel-session.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/duel-session.ts
  - src/tools/action-tools.ts
  - test/duel-session.test.ts
  - docs/manual-testing-guide.md
---

## What changed

Challenge target selection now consumes `EntitySnapshot` records and preserves Chinese mob aliases, non-player filtering, range limits and nearest-target selection. Duel tick decisions moved into a pure state reducer covering self death, temporary target loss, loss timeout, approach/hold movement, attack range and cooldown. The kill message now uses the shared runtime chat path.

## Why it matters

Chat and MCP challenge entry points no longer inspect Mineflayer's native entity table. The timing and lifecycle rules can be tested without Minecraft, reducing the amount of behavior that a future Modded Client adapter must reproduce and preventing one-hit attack semantics from replacing a sustained duel.

## Demo posture / limitations

This is an internal boundary refactor, not complete Adapter-backed combat, Modded Client support, an install demo or GA behavior. Native Mineflayer entity-death subscriptions, pathfinder pursuit and hit execution remain in `action-tools.ts` and still require an in-game regression pass.
