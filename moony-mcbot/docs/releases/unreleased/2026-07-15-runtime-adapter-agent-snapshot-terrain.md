---
type: refactor
scope: runtime
audience: developer
summary: Agent state snapshots now source local terrain feet and crosshair blocks through the client adapter.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-agent-snapshot-terrain.md
---

## What changed

`buildAgentStateSnapshot` now uses `BotRuntime.getBlockObservation(4)` for `localWorld.terrain.feetBlock` and `inSightBlock` instead of directly reading Mineflayer blocks.

## Why it matters

The agent's immediate terrain context now uses the same block-observation contract as `observe.blocks`. A future modded adapter can provide these basic fields without exposing native client block APIs to the planner.

## Demo posture / limitations

Visible-block scanning, mining target discovery, nearby-entity classification, status effects, and pathfinder state remain Mineflayer-specific at this stage. This change does not add a modded-client world scanner.
