---
type: feature
scope: runtime
audience: developer
summary: Attack Nearest debug actions now report target selection details.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-attack-nearest-selection.md
---

## What changed

The Web debug `Attack Nearest` action now returns a `selection` object before the execution result. It includes the effective filters, observed entity count, matching candidate count, nearest matching candidate, nearby observed entities, ignored player count, and a short hint.

## Why it matters

When `includePlayers=false`, the action can legitimately do nothing visible in-game if there are no nearby non-player entities. The debug panel now explains whether the problem is no target, distance, filters, or player exclusion.

## Demo posture / limitations

This only improves the Web debug action response. The public `interact.attackNearestEntity` MCP tool contract is unchanged, and the change does not prove that attack animation or server-side damage occurred; in-game confirmation is still required for final behavior validation.
