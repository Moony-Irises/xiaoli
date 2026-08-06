---
type: feature
scope: runtime
audience: developer
summary: Web debug panel now records recent quick-action history.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-06-runtime-debug-panel-action-history.md
---

## What changed

Added an in-memory `Action History` log to the local Web debug panel. Every Web quick action now records timestamp, bot id, action name, sanitized payload, success or failure, and the returned result or error. The server also emits a structured log line for completed and failed debug actions.

## Why it matters

Remote-control testing can make in-game feedback hard to observe. The panel now provides an auditable trail of what was actually requested and how the runtime responded, instead of relying only on the Minecraft window.

## Demo posture / limitations

The history is in-memory and limited to the most recent 80 debug-panel actions. It covers Web debug actions only; MCP calls from external clients are not yet included in this panel history.
