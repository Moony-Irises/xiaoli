---
type: feature
scope: runtime
audience: developer
summary: Added runtime dual-write for shared player and place memory with Web status visibility.
breaking: false
demo_ready: false
tests:
  - cmd /c npm test
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/shared-memory-plan.md
  - TODO.md
  - C:\xiaoli\memory\README.md
  - docs/releases/unreleased/2026-07-16-runtime-shared-game-memory-dual-write.md
---

## What changed

McBot now queues shared `players.json` and `places.json` writes whenever player or place memory is updated, deleted, or cleared. The debug Web panel exposes the shared paths, file counts, last successful write, and last write error.

## Why it matters

Minecraft-side facts can now be prepared for future Voice and livestream consumers without moving credentials, chat pending buffers, transient task history, or runtime configuration into the shared memory directory. Legacy `chat-configs.json` persistence remains in place during the migration.

## Demo posture / limitations

This is a dual-write migration step, not shared-memory startup loading. McBot does not yet restore or override its runtime player/place maps from `players.json` or `places.json`; restart recovery from the shared files remains a later phase.
