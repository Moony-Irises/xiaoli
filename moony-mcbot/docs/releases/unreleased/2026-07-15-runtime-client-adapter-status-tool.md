---
type: feature
scope: runtime
audience: developer
summary: MCP clients can now query the active client adapter through a dedicated read-only status tool.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-client-adapter-status-tool.md
---

## What changed

Added `client.adapter.status`, which returns the same runtime adapter snapshot used by the local Web debug panel: adapter kind, connection state, declared capability support, and recent actions routed through unified adapter delegates.

## Why it matters

Adapter migration diagnostics are now available from MCP Inspector, CherryStudio, and future automation clients rather than requiring the local browser panel. This creates one read-only contract for comparing future Mineflayer and modded-client adapters.

## Demo posture / limitations

The tool does not execute actions, establish a bridge, or expose credentials. Recent actions are bounded in-memory diagnostics and cover only methods already routed through `BotRuntime` adapter delegates.
