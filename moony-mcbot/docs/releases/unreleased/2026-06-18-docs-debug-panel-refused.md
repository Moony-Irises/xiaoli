---
type: docs
scope: docs
audience: developer
summary: Document how to diagnose debug panel connection refused errors
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - docs/manual-testing-guide.md
---

## What changed

Expanded the manual testing guide with concrete PowerShell checks for `http://127.0.0.1:4637/` connection refused errors, including port inspection and Node process command-line inspection.

## Why it matters

The debug panel only exists while the MCP server process is running. A refused connection usually means the server process was never started or the MCP client disconnected, not that the bot itself failed a runtime check.

## Demo posture / limitations

This is documentation only. It does not add a standalone debug-panel launcher or change server startup behavior.
