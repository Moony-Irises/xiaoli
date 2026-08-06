---
type: feature
scope: runtime
audience: developer
summary: The Web debug panel now makes runtime state and risky actions easier to scan.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-summary-status-cards.md
---

## What changed

The four summary cards now show a color-coded status strip and a compact badge. Bot and agent state are classified as ready, active, waiting, or error; goals distinguish configured from absent; tasks distinguish idle from active or error. The `Attack Nearest` control now has a separate risk treatment and clearer hover warning.

## Why it matters

Remote debugging often starts from the top of the panel. The status meaning is now visible without parsing raw JSON or inferring it from English state names, while the potentially destructive attack operation is less likely to be mistaken for a normal interaction action.

## Demo posture / limitations

This is a display-only improvement. It does not alter action endpoints, authorization, targeting filters, bot behavior, or MCP contracts. State classification is intentionally simple and based on the existing runtime strings.
