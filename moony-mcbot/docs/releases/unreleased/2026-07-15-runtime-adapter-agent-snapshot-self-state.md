---
type: refactor
scope: runtime
audience: developer
summary: Agent state snapshots now source their self-state section through the client adapter.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-agent-snapshot-self-state.md
---

## What changed

`buildAgentStateSnapshot` now reads position, rotation, movement velocity, vitals, and self-guard decisions from `BotRuntime.getSelfState()`. It requires an adapter self snapshot before constructing the planning state and uses null for optional fields unavailable from a future adapter.

## Why it matters

The agent's own-state context now has one client-facing source shared with `observe.self`. A future modded client can provide planning-critical health, movement, and position information without exposing Mineflayer entity objects to the planner.

## Demo posture / limitations

World perception remains mixed at this stage: local terrain, visible blocks, nearby entities, status effects, and pathfinder state still use the current Mineflayer route. This does not add a modded-client world-perception implementation.
