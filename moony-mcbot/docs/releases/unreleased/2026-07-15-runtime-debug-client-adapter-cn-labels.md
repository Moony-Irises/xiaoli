---
type: feature
scope: runtime
audience: developer
summary: The Web debug panel now adds Chinese labels to client-adapter capabilities and actions.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/debug/debug-server.ts
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
  - docs/releases/unreleased/2026-07-15-runtime-debug-client-adapter-cn-labels.md
---

## What changed

The `Client Adapter` Web panel now renders each declared capability and recent adapter action with a Chinese-first label while preserving its machine `id` or `action` field. The underlying debug API response remains unchanged.

## Why it matters

The adapter panel can now be read during normal manual testing without memorizing implementation-oriented snake_case names, while still allowing an exact lookup in source code and logs.

## Demo posture / limitations

Labels cover the currently declared adapter capability set. Unknown future action names fall back to their raw identifier until a display label is deliberately added. This does not localize MCP tool contracts or change adapter behavior.
