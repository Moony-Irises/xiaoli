---
type: feature
scope: runtime
audience: developer
summary: Added startup import that merges newer shared game-memory records with legacy fallback.
breaking: false
demo_ready: false
tests:
  - cmd /c npm test
  - cmd /c npm run build
artifacts:
  - src/memory/merge-records.ts
  - src/tools/action-tools.ts
  - test/shared-game-memory-store.test.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/shared-memory-plan.md
  - TODO.md
  - C:\xiaoli\memory\README.md
  - docs/releases/unreleased/2026-07-16-runtime-shared-game-memory-import.md
---

## What changed

Startup now restores legacy McBot memory first, then imports shared player and place records only when their `updatedAt` is newer. `memory.status` and the Web debug panel expose shared-memory load timing, import counts, and load errors.

## Why it matters

Shared memory can become the preferred source of cross-module game facts without discarding a local record that is newer or exists only in the legacy configuration. The pure merge helper has an offline regression test for this timestamp rule.

## Demo posture / limitations

No one-time migration or legacy cleanup occurs. Shared files are still limited to player and place facts; task history, chat buffers, credentials, and live runtime state remain outside this import path.
