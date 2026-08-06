---
type: feature
scope: runtime
audience: developer
summary: The local debug panel now remembers collapsed sections in the browser.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-panel-layout-persistence.md
---

## What changed

The Web debug panel now stores the open or closed state of its normal status sections in browser local storage. `Expand All`, `Collapse All`, and manual section toggles update that local preference; it is restored before the panel starts its first refresh.

## Why it matters

The panel can stay focused on the sections relevant to a testing session. Refreshing the page or reopening the local URL no longer forces a long list of panels back into the default layout.

## Demo posture / limitations

The preference is local to one browser profile and does not sync between devices or browsers. Clearing browser site data resets the layout. It does not affect bot configuration, runtime state, shared memory, or MCP behavior.
