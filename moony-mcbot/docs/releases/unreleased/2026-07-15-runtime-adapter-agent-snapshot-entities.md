---
type: refactor
scope: runtime
audience: developer
summary: Agent state snapshots now source nearby non-player entities through the client adapter.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-agent-snapshot-entities.md
---

## What changed

`buildAgentStateSnapshot` now obtains nearby non-player entities from `BotRuntime.getNearbyEntities(24)`. It preserves the existing category, relation, threat-level, display, and distance fields, and uses an internal fallback key when a future adapter cannot provide an entity ID.

## Why it matters

Entity awareness is planning-critical for threat assessment and interaction decisions. The state snapshot can now consume the same entity contract exposed by observation tools, which gives a future modded adapter one route for reporting nearby mobs and objects.

## Demo posture / limitations

Nearby player collection, visible-block scanning, status effects, focus perception, salient perception, and pathfinder state remain Mineflayer-specific. Unknown future adapter distances are sorted after known-distance entities.
