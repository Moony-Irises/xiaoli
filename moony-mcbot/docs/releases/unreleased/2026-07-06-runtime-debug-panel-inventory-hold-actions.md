---
type: feature
scope: runtime
audience: developer
summary: Web debug panel now exposes inventory hold actions.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-06-runtime-debug-panel-inventory-hold-actions.md
---

## What changed

Added `Hold Slot` and `Hold Category` buttons to the local Web debug panel. These actions call the runtime adapter methods directly and then refresh the panel state like other quick actions.

## Why it matters

Inventory hand-selection tests no longer require MCP Inspector or hand-written JSON. This makes the newly adapter-backed `inventory.holdSlot` and `inventory.holdByCategory` path easy to verify from the same page as `Observe Inventory`.

## Demo posture / limitations

This is still a developer debug shortcut, not a full command console. It only covers hotbar slot selection and category-based item holding; more general raw tool execution remains a separate future item.
