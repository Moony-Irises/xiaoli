---
type: feature
scope: runtime
audience: developer
summary: The debug panel can clear action history for the selected bot.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-action-history-clear.md
---

## What changed

Added a `Clear History` button to the local Web debug panel and a matching controlled raw action. It clears Web action-history entries for the selected bot, then records the clear action itself as an audit marker.

## Why it matters

Manual test passes can now start from a clean action history without restarting the MCP server. This makes exported history easier to read when running focused regression checks.

## Demo posture / limitations

This only clears the in-memory Web debug action history for the selected bot. It does not clear agent events, memory, logs, MCP client history, or persisted configuration.
