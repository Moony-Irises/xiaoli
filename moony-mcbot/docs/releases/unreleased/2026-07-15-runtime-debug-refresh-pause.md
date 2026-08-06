---
type: feature
scope: runtime
audience: developer
summary: The local debug panel can now pause and resume its automatic refresh loop.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-refresh-pause.md
---

## What changed

The status action group now includes a `Pause Refresh` control. It changes to `Resume Refresh` while paused and controls the debug page's existing three-second polling loop.

## Why it matters

Remote testing can require inspecting a transient action result or observation snapshot. The page can now remain on the currently rendered evidence without stopping the Minecraft bot or disconnecting the MCP server.

## Demo posture / limitations

This only pauses browser-side polling for the current page session. Manual `Refresh` still works while paused, and the setting is not persisted across a page reload. It does not alter runtime scheduling, actions, chat listeners, or Agent execution.
