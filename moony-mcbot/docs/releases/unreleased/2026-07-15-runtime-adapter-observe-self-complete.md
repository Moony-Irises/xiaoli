---
type: refactor
scope: runtime
audience: developer
summary: Observe-self now reads all returned state through the unified client-adapter snapshots.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-observe-self-complete.md
---

## What changed

`observe.self` no longer fetches the native Mineflayer bot. It reads identity, vitals, game metadata, position, movement, held item, and armor through `BotRuntime` self and inventory snapshots. If self state is unavailable, it returns a clear observation error.

## Why it matters

The tool now has one client-facing data source that a future modded adapter can implement. Normal Mineflayer output keeps the same public shape, while partial future adapters can represent unavailable values as null instead of mixing implementations.

## Demo posture / limitations

This completes adapter ownership for the `observe.self` tool only. Other tools and continuous systems may still access native Mineflayer data, including visible block scans, containers, pathfinder loops, and combat loops.
