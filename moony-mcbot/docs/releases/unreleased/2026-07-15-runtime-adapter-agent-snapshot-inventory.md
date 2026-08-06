---
type: refactor
scope: runtime
audience: developer
summary: Agent state snapshots now source inventory and equipment summaries through the client adapter.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-agent-snapshot-inventory.md
---

## What changed

`buildAgentStateSnapshot` now obtains held item, armor, free-slot count, food selection, tool availability, and item summary from `BotRuntime.getInventoryState(true)`. The published `selfState.equipment` and `selfState.inventory` fields retain their existing shape.

## Why it matters

Agent planning and the debug state snapshot now share the same inventory abstraction as observe and interaction tools. A future modded adapter can supply this logistics context without requiring the planning layer to read Mineflayer inventory internals.

## Demo posture / limitations

Only the inventory and equipment portion moved in this change. Local-world perception, status effects, visible block scanning, pathfinder state, and some movement/vitals fields still depend on the current Mineflayer runtime path.
