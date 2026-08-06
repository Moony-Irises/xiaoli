---
type: refactor
scope: runtime
audience: developer
summary: Follow lost-target observation gestures now use the unified client-adapter look action.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-adapter-follow-lost-target-look.md
---

## What changed

When a follow target is no longer observable, the existing three-step look-around gesture now reads yaw and pitch from the runtime snapshot and calls `runtime.look()` for each turn. Missing self-state simply skips the optional gesture.

## Why it matters

The gesture now uses the same adapter action path and recent-action diagnostics as other basic look actions. This moves a bounded part of follow behavior toward the future client-adapter boundary without disturbing the Mineflayer pathfinder loop.

## Demo posture / limitations

Follow pathfinding, control-state management, target-distance decisions, and fallback steering remain native Mineflayer behavior. This does not make `move.followPlayer` fully adapter-independent or add a modded-client follow implementation.
