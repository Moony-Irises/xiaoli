---
type: refactor
scope: runtime
audience: developer
summary: Route interact.rightClick through the client adapter action boundary
breaking: false
demo_ready: false
tests: cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - README.md
---

## What changed

`ClientAdapter` now exposes `useHeldItem()`, with the current `MineflayerAdapter` mapping it to block activation or held-item use. `BotRuntime` forwards the action, and `interact.rightClick` now executes through the runtime/adapter boundary instead of directly calling the native mineflayer bot.

## Why it matters

Right-click/use-item is one of the core player actions that a future modded-client bridge must support. Moving this tool behind the adapter boundary reduces direct coupling between MCP tools and mineflayer-specific APIs.

## Demo posture / limitations

This is a refactor of the execution path, not a new gameplay feature. It does not yet migrate open-door, attack, container, or complex GUI click behavior; those still need separate adapter capabilities.
