---
type: refactor
scope: runtime
audience: developer
summary: Observe-self equipment now comes from the unified client-adapter inventory snapshot.
breaking: false
demo_ready: true
tests:
  - cmd /c npm test
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - test/client-adapter-status.test.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-observe-self-equipment.md
---

## What changed

The shared inventory snapshot now contains structured head, torso, legs, and feet entries. `observe.self` reads its held item and armor names from that runtime inventory snapshot instead of directly accessing Mineflayer inventory slots. Offline inventory snapshots return the same complete armor shape with null values.

## Why it matters

Equipment is now available through the client-adapter boundary that a future modded client can implement. The public `observe.self` response keeps the same held-item and armor-name shape, so existing callers do not need to change.

## Demo posture / limitations

This only migrates equipment reads. Position, motion, and game metadata in `observe.self` still retain native Mineflayer fallback data. The armor slot layout currently reflects the existing Java inventory convention used by the Mineflayer adapter.
