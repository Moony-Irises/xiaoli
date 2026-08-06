---
type: feature
scope: runtime
audience: developer
summary: Unified client-adapter actions now expose a bounded recent-action history for debugging.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/bot-runtime.ts
  - README.md
  - docs/manual-testing-guide.md
  - docs/modded-client-adapter-plan.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-client-adapter-action-history.md
---

## What changed

`BotRuntime` now keeps the latest 24 results from actions that already use its unified client-adapter delegates. The adapter status snapshot includes these records, and the existing `Client Adapter` debug panel renders them. Chat records are intentionally reduced to `chat sent` rather than preserving message text.

## Why it matters

Remote debugging can now distinguish an action that reached the adapter from one that only appeared in a high-level plan or Web action request. The same record shape gives a future modded adapter a concrete observability target.

## Demo posture / limitations

This is a bounded in-memory history, cleared when the runtime restarts. It covers only calls already routed through `BotRuntime` adapter delegates. Follow-pathfinder loops, container sessions, and other remaining native Mineflayer paths are not represented as fully adapter-managed actions.
