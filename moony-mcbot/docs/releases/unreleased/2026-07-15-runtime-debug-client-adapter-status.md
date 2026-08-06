---
type: feature
scope: runtime
audience: developer
summary: The local debug panel now exposes the active client adapter and its declared capabilities.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/modded-client-adapter-plan.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-client-adapter-status.md
---

## What changed

`ClientAdapter` now publishes one canonical list of declared capabilities. `BotRuntime` exposes a read-only adapter status snapshot containing adapter kind, connection state, and support for every declared capability. The Web debug payload renders that snapshot in a collapsed `Client Adapter` panel.

## Why it matters

The current Mineflayer route has an observable baseline before a real modded-client bridge exists. Future adapters can be compared against the same capability surface rather than relying on an informal list of migrated tools.

## Demo posture / limitations

This reports the existing Mineflayer adapter only. It does not add a ModdedClientAdapter, a companion mod, bridge transport, GUI visibility, or an adapter action queue. Capability support is a declared implementation property, not evidence that a particular in-game action just succeeded.
