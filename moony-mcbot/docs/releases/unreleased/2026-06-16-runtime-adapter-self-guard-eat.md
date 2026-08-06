---
type: refactor
scope: runtime
audience: developer
summary: Route self-guard and chat-intent eating through runtime.eatFood
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
---

## What changed

Self-guard auto-eating and the whitelist chat "eat" intent now call `BotRuntime.eatFood()` instead of directly equipping food and calling the native consume action from `action-tools.ts`. The old local `eatFromInventory()` helper was removed.

## Why it matters

Eating behavior now has one lower-level execution point: the client adapter. This keeps self-preservation behavior aligned with the same runtime boundary used by the public `interact.eat` MCP tool.

## Demo posture / limitations

This is only an execution-path refactor. It does not add food whitelists, owner approval, food hotbar slot management, nutrition scoring, or modded food support.
