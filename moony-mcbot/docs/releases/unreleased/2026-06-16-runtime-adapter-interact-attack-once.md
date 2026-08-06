---
type: refactor
scope: runtime
audience: developer
summary: Route one-shot interact attack tools through the client adapter boundary
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - README.md
---

## What changed

`ClientAdapter` now exposes `attackPlayer()` and `attackNearestEntity()` action capabilities. The current `MineflayerAdapter` performs target lookup, equips the best sword or axe it can find, looks toward the target, and performs one attack. The public MCP tools `interact.attackPlayer` and `interact.attackNearestEntity` now call through `BotRuntime`.

## Why it matters

Single-hit attack tools were still tightly coupled to mineflayer entity structures and direct `bot.attack(...)` calls. Moving these public tools behind the adapter boundary makes the action surface more consistent with the future modded-client adapter plan.

## Demo posture / limitations

This only migrates one-shot public attack tools. It does not migrate duel loops, self-guard retaliation, challenge behavior, target memory, pathfinding approach, shields, cooldown timing, or modded combat mechanics.
