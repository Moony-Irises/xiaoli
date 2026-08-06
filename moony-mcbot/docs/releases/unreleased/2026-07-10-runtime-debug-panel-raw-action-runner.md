---
type: feature
scope: runtime
audience: developer
summary: The debug panel now includes a controlled raw action runner.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-10-runtime-debug-panel-raw-action-runner.md
---

## What changed

Added a collapsed `Raw Action Runner` section to the local Web debug panel. It lists the existing Web `/api/action/*` debug actions, loads JSON templates, optionally injects the selected `botId`, and sends the JSON payload through the same action path used by the quick buttons.

## Why it matters

Some debug actions need structured parameters that are awkward to enter through repeated browser prompts or MCP Inspector forms. This gives local testing a faster JSON path while keeping the action surface limited to the already-supported Web debug actions.

## Demo posture / limitations

This is not a full arbitrary MCP tool runner. It intentionally does not expose `bot.connect`, `bot.disconnect`, or every registered MCP tool. Dangerous actions such as `attack-nearest` still require a confirmation in the browser.
