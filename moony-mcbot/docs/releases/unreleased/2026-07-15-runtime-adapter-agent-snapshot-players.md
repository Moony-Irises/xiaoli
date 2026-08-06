---
type: refactor
scope: runtime
audience: developer
summary: Agent state snapshots now source nearby players through the client adapter without changing observe-player output.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-agent-snapshot-players.md
---

## What changed

Player snapshots now retain an internal optional entity ID. `buildAgentStateSnapshot` obtains nearby players through `BotRuntime.getNearbyPlayers(32)` and combines them with adapter-sourced non-player entities using internal dedupe keys. `observe.nearbyPlayers` removes the internal ID before returning its existing public response shape.

## Why it matters

The agent's nearby-player context now follows the same adapter boundary as nearby entities. This preserves planner identity and deduplication needs while avoiding an accidental MCP response-contract change for existing observe clients.

## Demo posture / limitations

The current Mineflayer adapter remains the only implementation. Visible-block scanning, focus perception, salient perception, status effects, and pathfinder state still use Mineflayer-specific APIs. The player adapter query is limited to the existing 32-block nearby-player radius.
