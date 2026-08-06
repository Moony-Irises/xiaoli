---
type: feature
scope: runtime
audience: developer
summary: The manual test backlog and debug panel visibility controls were added.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-10-runtime-debug-panel-test-backlog-controls.md
---

## What changed

Added a consolidated pending-test backlog to the manual testing guide and added `Expand All` / `Collapse All` controls to the local Web debug panel.

## Why it matters

Recent debug, prompt, memory, chat, observe, and action-button changes had test notes spread across multiple docs and conversations. A single backlog makes the next manual game test pass easier to run, while panel-wide visibility controls reduce scrolling when the debug page has many sections.

## Demo posture / limitations

This improves test guidance and panel ergonomics only. It does not add Web login/connect buttons, does not replace in-game verification, and does not validate modded-client bridge behavior.
