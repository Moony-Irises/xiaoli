---
type: feature
scope: runtime
audience: developer
summary: Debug-panel summary cards now navigate directly to their detailed status sections.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-summary-navigation.md
---

## What changed

The Bot, Agent, Goal, and Task summary cards are now keyboard-accessible navigation controls. Selecting a card opens its matching detail panel, preserves the layout preference, and scrolls the panel below the sticky toolbar. Goal and Task both lead to the execution trace.

## Why it matters

The top-level status view now doubles as an index into the detailed data. A tester can move from a compact status signal to the relevant raw payload without manually locating a collapsed section.

## Demo posture / limitations

This is a client-side navigation enhancement only. It does not refresh data, change status classification, invoke a bot action, or change any API or MCP contract.
