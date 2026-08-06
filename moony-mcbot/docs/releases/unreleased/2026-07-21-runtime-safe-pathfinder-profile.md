---
type: fix
scope: runtime
audience: developer
summary: Added a non-destructive Pathfinder profile for ordinary movement while keeping explicit mining paths separate.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run build
  - npm run typecheck
  - npm test
artifacts:
  - src/runtime/pathfinder-movement-profile.ts
  - src/tools/action-tools.ts
  - test/pathfinder-movement-profile.test.ts
  - package.json
  - README.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-21-runtime-safe-pathfinder-profile.md
---

## What changed

Ordinary Pathfinder movement now uses a safe profile with digging, one-block towers, scaffolding, parkour, sprint-path shortcuts, and large drops disabled. Explicit mining actions use a separate mining profile so this safety change does not remove the existing mining route.

## Why it matters

Following, wandering, moving to a remembered place, and chasing a target should not modify the world just to reach a destination. The safety boundary is now encoded and unit-tested instead of relying on Pathfinder defaults.

## Demo posture / limitations

This change protects Pathfinder-generated movement decisions. Direct control-state fallback and explicit mining still require in-game verification, and it does not yet cover modded-client movement or container-aware navigation.
