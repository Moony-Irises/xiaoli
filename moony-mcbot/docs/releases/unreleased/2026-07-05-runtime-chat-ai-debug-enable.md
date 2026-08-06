---
type: feature
scope: runtime
audience: developer
summary: Add default env and debug-panel controls for in-game AI small-talk
breaking: false
demo_ready: true
tests: cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - src/debug/debug-server.ts
  - .env.local.example
  - README.md
  - docs/manual-testing-guide.md
  - TODO.md
---

## What changed

Added `MCBOT_DEFAULT_CHAT_AI_*` environment settings for the default bot and a Web debug panel `Enable AI Chat` action. The panel now also exposes `Chat AI` status separately from the fixed-reply command listener.

## Why it matters

Having `MCBOT_AI_API_KEY` available does not mean in-game AI small-talk is enabled. This makes that state visible and recoverable without needing CherryStudio or MCP Inspector.

## Demo posture / limitations

This only controls the in-game `chat.ai` small-talk listener. It does not enable the strategic agent planner, and model calls still require a valid API key and compatible API base/model settings.
