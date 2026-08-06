---
type: feature
scope: runtime
audience: developer
summary: The debug panel now shows and reloads the active McBot prompt profile.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-10-runtime-debug-panel-prompt-profile.md
---

## What changed

Added a collapsed `Prompt Profile` section to the local Web debug panel. It shows the active prompt profile path, the shared-memory McBot prompt path, the legacy AppData path, and the loaded profile. A new `Reload Prompt` button reloads the active prompt profile from disk and records the result in `Last Action Result` and `Action History`.

## Why it matters

Prompt iteration no longer requires MCP Inspector or guessing which file the running process loaded. This is useful now that the McBot prompt profile defaults to `C:\xiaoli\memory\prompts\mcbot-prompt-profile.json`.

## Demo posture / limitations

This is a local developer/debug feature. It does not edit prompt files in the browser, does not start a bot, and does not verify model behavior. After reload, actual chat style still depends on the configured model and active chat AI settings.
