---
type: fix
scope: runtime
audience: developer
summary: AI chat and planner API URL handling now accepts either a base URL or a full chat completions endpoint.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
---

## What changed

Centralized OpenAI-compatible chat completions endpoint construction for both in-game AI chat and the agent planner.

## Why it matters

Local configuration is less fragile: `MCBOT_AI_API_BASE_URL` can now be set to a provider base URL such as `https://api.example.com/v1` or to a full endpoint such as `https://api.example.com/v1/chat/completions` without producing `/chat/completions/chat/completions`.

## Demo posture / limitations

This only normalizes URL construction for OpenAI-compatible chat completions APIs. It does not add support for non-compatible provider request or response formats.
