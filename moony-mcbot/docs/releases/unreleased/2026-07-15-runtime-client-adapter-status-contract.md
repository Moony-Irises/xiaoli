---
type: test
scope: runtime
audience: developer
summary: Added an offline regression test for the client-adapter status contract.
breaking: false
demo_ready: false
tests:
  - cmd /c npm test
  - cmd /c npm run build
artifacts:
  - package.json
  - test/client-adapter-status.test.ts
  - README.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-client-adapter-status-contract.md
---

## What changed

Added a Node test-runner command and a focused offline test that creates a `BotRuntime` without authentication or server connection. It verifies the Mineflayer adapter kind, idle connection state, declared capability keys, supported flags, and empty initial action history.

## Why it matters

The newly exposed adapter status has a machine-readable contract shared by the Web panel and MCP tool. The test detects accidental drift between the declared capability list and the Mineflayer implementation before a real game session is required.

## Demo posture / limitations

This is an offline contract test only. It does not contact an auth server, connect to Minecraft, invoke MCP transport, or validate in-game behavior. Those paths remain covered by the manual testing guide.
