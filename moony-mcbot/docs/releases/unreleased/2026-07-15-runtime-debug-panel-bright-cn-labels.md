---
type: feature
scope: runtime
audience: developer
summary: The debug panel now uses a bright theme and Chinese control labels.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-panel-bright-cn-labels.md
---

## What changed

The Web debug panel now uses a bright warm theme instead of the previous dark control-room layout. Common toolbar buttons, quick action buttons, status cards, panel titles, prompt dialogs, confirmation dialogs, status messages, and raw action labels now include Chinese labels alongside their English names. Frequently used buttons also include Chinese `title` tooltips for hover help. The top toolbar is grouped by status, history, goal, chat, item, interaction, and dangerous actions.

## Why it matters

The debug panel is now easier to use during remote testing because common controls no longer require translating or remembering English-only action names. The brighter layout also makes status cards and collapsible sections easier to scan, and grouped controls reduce the need to search through one long button row.

## Demo posture / limitations

This is a debug-panel UI improvement only. It does not change bot behavior, MCP tool contracts, login flow, or action execution semantics.
