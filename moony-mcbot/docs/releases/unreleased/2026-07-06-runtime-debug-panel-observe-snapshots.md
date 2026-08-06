---
type: feature
scope: runtime
audience: developer
summary: Web debug panel now exposes common observe snapshots as first-class sections.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-06-runtime-debug-panel-observe-snapshots.md
---

## What changed

Added an adapter-backed debug observe snapshot for self state, inventory, nearby players, nearby entities, and block observation. The local Web debug panel now renders these as separate sections and includes a `Refresh Observe` shortcut.

## Why it matters

Daily runtime checks no longer need MCP Inspector calls for common read-only observations. This makes it easier to verify adapter migration work and to compare debug-panel state with what is actually visible in game.

## Demo posture / limitations

This is a local developer/debug view only. It reads from the current runtime adapter and does not add new gameplay behavior. More complex visible-block scans and container views are still handled by older mineflayer-specific paths elsewhere.
