---
type: fix
scope: runtime
audience: developer
summary: Ensure default chat listener environment settings override stale persisted listener config
breaking: false
demo_ready: true
tests: cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - docs/manual-testing-guide.md
  - TODO.md
---

## What changed

Default chat-listener environment settings are now applied after persisted chat state is loaded, so `.env.local` can repair stale or corrupted local listener values such as a mojibake wake name.

## Why it matters

If an older `chat-configs.json` stored a broken `wakeNames` value, in-game commands like `小狸 跟我` would not reach the intent handler even though the listener was enabled and attached. The startup environment should be able to restore the expected local test defaults.

## Demo posture / limitations

This fixes startup precedence for the default listener path. A running process still needs to be restarted, or the Web debug panel's `Enable hi Reply` action must be used, before the current runtime sees the corrected wake name.
