---
type: feature
scope: runtime
audience: developer
summary: The debug panel now shows shared McBot chat-memory status.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-10-runtime-debug-panel-shared-chat-memory.md
---

## What changed

Added a `Shared Chat Memory` section to the local Web debug panel. It reuses the existing shared chat-memory status backend and shows the memory directory, summary state path, summaries path, episodes path, summary threshold, pending counts by bot, total observed/summarized entries, and whether a summary API key is available.

## Why it matters

The old `Memory` panel only covered agent-local player/place/task memory. Shared rolling chat memory lives under `C:\xiaoli\memory`, so it needed its own visible status area to debug whether whitelisted chat is being buffered and summarized.

## Demo posture / limitations

This is read-only debug visibility. It does not force a summary, edit memory, or validate actual in-game chat capture. It only exposes the same status returned by `memory.chat.status`.
