---
type: feature
scope: runtime
audience: developer
summary: Add adapter-backed action buttons to the local debug panel
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

Added local debug-panel actions for eating, right-click/use-item, opening doors, and attacking the nearest non-player entity. These actions call `BotRuntime` methods, so they exercise the same client-adapter path used by the public interaction tools.

## Why it matters

Common adapter-regression checks no longer require CherryStudio, MCP Inspector, or hand-written JSON. The panel can now validate whether recently migrated interaction actions still affect the real game client.

## Demo posture / limitations

The attack button intentionally defaults to non-player entities and asks for browser confirmation. This is still a developer debug surface, not a full safety-reviewed command UI.
