---
type: feature
scope: runtime
audience: developer
summary: The debug panel can copy or download the latest full debug snapshot.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-snapshot-export.md
---

## What changed

Added `Copy Snapshot` and `Download Snapshot` buttons to the local Web debug panel. They export the latest full `/api/debug` payload cached by the page, with downloaded files named by bot id and timestamp.

## Why it matters

When remote testing, a single full snapshot is often easier to share than copying each panel separately. This gives one JSON artifact containing bot status, agent status, trace, observe snapshots, memory status, action history, and recent events.

## Demo posture / limitations

This is browser-side export only. It exports the latest snapshot already fetched by the page; it does not persist data server-side and does not include external MCP client history beyond what the debug payload already exposes.
