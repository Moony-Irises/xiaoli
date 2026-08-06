---
type: feature
scope: runtime
audience: developer
summary: The debug panel can copy action results and raw JSON payloads.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-10-runtime-debug-panel-copy-actions.md
---

## What changed

Added `Copy Result` beside `Last Action Result` and `Copy JSON` inside `Raw Action Runner`. Both buttons copy the current text to the clipboard and update the debug status line with success or failure.

## Why it matters

Remote-control testing often makes it hard to watch the game screen and capture exact runtime feedback. Copyable JSON results make it easier to preserve evidence from Web debug actions without opening MCP Inspector.

## Demo posture / limitations

This is a browser-side convenience feature only. It does not persist history to disk, does not change action execution behavior, and depends on browser clipboard permissions or the fallback copy command.
