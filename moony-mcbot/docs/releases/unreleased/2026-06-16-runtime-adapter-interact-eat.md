---
type: refactor
scope: runtime
audience: developer
summary: Route interact.eat through the client adapter action boundary
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

`ClientAdapter` now exposes an `eatFood()` action capability. The current `MineflayerAdapter` chooses either the requested food item or the first recognized food in inventory, equips it, and calls the native consume action. `BotRuntime` forwards the action, and `interact.eat` now runs through the runtime/adapter boundary.

## Why it matters

Eating is a small but real survival action. Moving it behind the adapter keeps tool execution less coupled to mineflayer-specific APIs and gives a future modded-client bridge a concrete capability to implement.

## Demo posture / limitations

This is not a new gameplay feature and does not add modded food knowledge. The adapter still uses a simple vanilla food-name allowlist, so complex modded foods and nutrition systems remain future work.
