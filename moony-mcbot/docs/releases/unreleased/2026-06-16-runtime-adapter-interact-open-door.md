---
type: refactor
scope: runtime
audience: developer
summary: Route interact.openDoor through the client adapter action boundary
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

`ClientAdapter` now exposes an `openDoor()` action capability. The current `MineflayerAdapter` first tries the block under the cursor, then searches for the nearest door within a bounded radius and activates it. The MCP tool, agent tool-call path, and whitelist chat intent now reuse `BotRuntime.openDoor()`.

## Why it matters

Door interaction is a small, visible world action that previously duplicated mineflayer-specific block scanning and activation logic in multiple places. Moving it behind the adapter boundary keeps the public tool and agent paths closer to the future modded-client adapter shape.

## Demo posture / limitations

This is a refactor of existing vanilla door behavior, not a broader block interaction system. It does not yet cover trapdoors, fence gates, modded doors, locked doors, redstone-only doors, or complex GUI/container interactions.
