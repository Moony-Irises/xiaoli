---
type: fix
scope: runtime
audience: developer
summary: The local debug panel now handles temporary polling failures without discarding its last snapshot.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-refresh-resilience.md
---

## What changed

The browser refresh loop now checks failed HTTP responses, catches request and JSON failures, and shows a Chinese-first refresh error in the toolbar. When a previous snapshot exists, the panel keeps it rendered while subsequent polling attempts continue.

## Why it matters

Starting or restarting the MCP server can temporarily interrupt the local Web endpoint. The debug page now stays useful during that gap instead of producing an unhandled polling error or immediately replacing useful evidence with an empty state.

## Demo posture / limitations

The preserved data is a stale last successful snapshot, not a live connection guarantee. A first load with no successful snapshot still renders the normal waiting state. This does not add server-side retries or alter bot runtime recovery.
