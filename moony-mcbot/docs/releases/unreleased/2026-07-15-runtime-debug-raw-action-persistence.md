---
type: feature
scope: runtime
audience: developer
summary: The debug panel now remembers Raw Action Runner input in the current browser.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-raw-action-persistence.md
---

## What changed

The Raw Action Runner now stores its selected endpoint, JSON text, and selected-bot injection checkbox in browser local storage. Reloading the local debug page restores that working form state. Loading a template intentionally replaces the current JSON and saves the replacement.

## Why it matters

Manual MCP-style testing often involves iterating on one payload. The local Web runner can now survive a page refresh or server restart without requiring the tester to reconstruct the same JSON fields.

## Demo posture / limitations

The state is browser-local and is cleared with site data. It is not shared between browsers, is not stored in bot configuration or shared memory, and is not an arbitrary MCP tool runner; its action set remains limited to the existing Web debug endpoints.
