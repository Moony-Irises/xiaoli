---
type: feature
scope: runtime
audience: developer
summary: The debug panel can copy or download the current action history.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-action-history-export.md
---

## What changed

Added `Copy History` and `Download History` buttons to the local Web debug panel toolbar. They export the currently rendered `Action History` text, with downloaded files named by bot id and timestamp.

## Why it matters

Remote-control testing often needs a complete record of what was clicked and what the runtime returned. Exporting action history makes it easier to preserve a full test pass without relying on screenshots or MCP Inspector output.

## Demo posture / limitations

This is browser-side export only. It does not persist history on the server, does not survive process restarts, and only exports the currently rendered in-memory debug history.
