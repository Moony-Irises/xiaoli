---
type: feature
scope: runtime
audience: developer
summary: Added an atomic shared-game-memory storage foundation for McBot player and place records.
breaking: false
demo_ready: false
tests:
  - cmd /c npm test
  - cmd /c npm run build
artifacts:
  - src/memory/game-memory-store.ts
  - test/shared-game-memory-store.test.ts
  - package.json
  - docs/shared-memory-plan.md
  - TODO.md
  - C:\xiaoli\memory\README.md
  - docs/releases/unreleased/2026-07-16-runtime-shared-game-memory-store.md
---

## What changed

Added `SharedGameMemoryStore`, which resolves the shared memory root from `XIAOLI_MEMORY_DIR` or `MCBOT_MEMORY_DIR`, reads and writes the planned `players.json` and `places.json` documents, validates records, and replaces structured files atomically. Offline tests cover missing files, normalized writes, malformed input, and temporary-file cleanup.

## Why it matters

McBot now has a safe storage boundary for the shared player and place facts that Voice and future modules can eventually consume. The implementation follows the shared-memory plan without mixing credentials, runtime configuration, or transient task state into the shared directory.

## Demo posture / limitations

This is a storage foundation only. McBot runtime has not started dual-writing or loading these files, so real `C:\xiaoli\memory\players.json` and `places.json` are untouched by this release. Task history, relationship records, preferences, and episode writes remain separate follow-up work.
