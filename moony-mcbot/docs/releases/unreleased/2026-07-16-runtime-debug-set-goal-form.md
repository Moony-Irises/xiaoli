---
type: feature
scope: runtime
audience: developer
summary: Replaced the Web Set Goal prompt sequence with a single goal configuration form.
breaking: false
demo_ready: true
tests:
  - cmd /c npm test
  - cmd /c npm run build
  - HTTP GET http://127.0.0.1:4638/ with a temporary no-bot server
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-16-runtime-debug-set-goal-form.md
---

## What changed

The Web debug panel now opens one native dialog for Set Goal. It shows the selected bot, explains each field, includes a complete Follow Judy example, and collects the goal, rationale, milestones, and current milestone index together. Milestones accept line breaks or commas.

## Why it matters

Goal setup no longer requires four sequential browser prompts, so a player can review and adjust the complete strategic request before any action is sent.

## Demo posture / limitations

This only changes the Web input experience. It still calls the existing `set-goal` action with the same payload and does not alter agent planning or in-game behavior. A regression test now parses the generated browser script so invalid template escaping fails before launch.
