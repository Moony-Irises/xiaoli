---
type: fix
scope: runtime
audience: developer
summary: Prevented cancelled connection attempts and stale reconnect timers from reviving a bot after manual disconnect.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run build
  - npm run typecheck
  - npm test
artifacts:
  - src/runtime/bot-runtime.ts
  - test/bot-runtime-connection.test.ts
  - package.json
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-21-runtime-connection-generation-guard.md
---

## What changed

Each BotRuntime connection attempt now carries a generation number. Manual disconnect invalidates the current generation, and authentication, adapter connection, readiness, reconnect timers, and Mineflayer lifecycle events ignore stale generations. Automatic reconnect also starts a fresh generation only after its timer is still valid.

## Why it matters

A disconnect during authentication or spawn could previously be followed by the old asynchronous operation completing and restoring the runtime to an online state. The generation guard makes manual disconnect authoritative without changing the existing `bot.connect` or `bot.disconnect` tool contracts.

## Demo posture / limitations

This change covers cancellation and stale reconnect protection. It does not yet add safe pathfinder profiles, chat message deduplication, model request cancellation, or Web authentication.
