---
type: feature
scope: runtime
audience: developer
summary: Expand the local debug web panel with common agent and chat-listener control actions
breaking: false
demo_ready: true
tests: cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
---

## What changed

The local debug web panel now shows chat-listener status, displays the raw JSON result from the last quick action, and exposes buttons for advancing/rewinding goals, running one agent planner turn, and enabling the `hi小狸 -> hihi` fixed reply.

## Why it matters

Daily testing no longer has to depend on CherryStudio or MCP Inspector for these high-frequency checks. The panel remains in-process with the MCP server, but it gives a simpler local control surface for validating agent state and common runtime behavior.

## Demo posture / limitations

This is a local developer/debug control surface, not a production admin console. It does not yet expose every MCP tool, and bot connect/disconnect actions are intentionally left out until they have safer confirmation UX.
