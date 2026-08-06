---
type: docs
scope: docs
audience: developer
summary: Documented the runtime stabilization, Agent convergence and modded-client entry roadmap.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run typecheck
artifacts:
  - CLAUDE.md
  - README.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/modded-client-adapter-plan.md
  - docs/releases/unreleased/2026-07-21-docs-architecture-convergence-roadmap.md
---

## What changed

Added a single architecture-convergence roadmap covering P0 runtime safety, P1 state and adapter convergence, P2 observability and maintenance, and the entry conditions for a Companion Mod plus Local Bridge MVP. Updated the project index, README architecture links, TODO priorities, and the modded-client plan.

## Why it matters

The project now has a documented gate between the existing Mineflayer prototype and the future real modded-client backend. The roadmap records which behavior must become deterministic first, which boundaries are being migrated, and how cloud models, local models, and local code divide responsibilities.

## Demo posture / limitations

This change is documentation only. It does not implement startup lifecycle fixes, Adapter Factory selection, Web authentication, Agent state migration, or the Companion Mod bridge. The listed P0 and P1 items remain engineering work before the modded-client MVP is ready.
