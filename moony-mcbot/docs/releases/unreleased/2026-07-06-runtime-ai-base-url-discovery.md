---
type: docs
scope: runtime
audience: developer
summary: Surface AI API base URL configuration in local env and debug panel flows
breaking: false
demo_ready: true
tests: cmd /c npm run build
artifacts:
  - .env.local.example
  - src/debug/debug-server.ts
  - src/tools/action-tools.ts
  - README.md
  - docs/manual-testing-guide.md
---

## What changed

Documented `MCBOT_AI_API_BASE_URL` in the local env example and testing docs, and added an optional API base URL prompt to the Web debug panel's `Enable AI Chat` action.

## Why it matters

The runtime already supported configurable AI API base URLs, but the local testing path did not make that discoverable. This made non-default OpenAI-compatible gateways look unsupported.

## Demo posture / limitations

`MCBOT_AI_API_BASE_URL` is still a shared default for chat AI and the agent planner. Runtime-specific overrides remain available through `chat.ai.configure.apiBaseUrl` and `agent.configure.plannerApiBaseUrl`.
