---
type: docs
scope: docs
audience: developer
summary: Manual test results were recorded for the current debug-panel backlog.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-10-docs-manual-test-results.md
---

## What changed

Recorded that the current A and B manual-test groups have been run, and marked `Attack Nearest` as needing a focused retest because the Web panel returned feedback but the in-game effect was unclear.

## Why it matters

The manual backlog now reflects real test progress instead of treating all recent debug-panel work as untested. The `Attack Nearest` note also clarifies that `includePlayers=false` only targets nearby non-player entities.

## Demo posture / limitations

This is documentation-only. It does not change runtime behavior or prove that `Attack Nearest` works in-game; that still needs a nearby mob or animal target and visible game confirmation.
