---
type: docs
scope: docs
audience: developer
summary: Document where to provide AI API keys during manual testing
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - docs/manual-testing-guide.md
---

## What changed

Added manual testing notes explaining that `MCBOT_AI_API_KEY` is the recommended place for AI and planner API keys, while `chat.ai.configure.apiKey` and `agent.configure.plannerApiKey` are runtime-only alternatives.

## Why it matters

The project no longer persists API keys to `chat-configs.json`, so returning to the project can be confusing if older notes or muscle memory suggest writing secrets into config files.

## Demo posture / limitations

This is documentation only. It does not change how API keys are loaded or persisted.
