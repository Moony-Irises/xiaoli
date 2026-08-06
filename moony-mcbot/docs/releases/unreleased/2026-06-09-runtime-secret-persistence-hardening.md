---
type: fix
scope: runtime
audience: developer
summary: Stop persisting chat and agent API keys into runtime config files
breaking: false
demo_ready: false
tests: cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - README.md
---

## What changed

`chat.ai.configure.apiKey` and `agent.configure.plannerApiKey` are no longer serialized into `chat-configs.json`. Legacy persisted key fields are ignored on load with a warning that points users toward environment variables or runtime-only configuration.

## Why it matters

The previous persistence format could write AI provider keys into a local JSON config file. That file is not intended for source control, but removing secrets from the persisted schema reduces accidental leakage and makes the project safer before pushing to a remote repository.

## Demo posture / limitations

This does not rotate any existing API key and does not delete old local config files. If an older `chat-configs.json` already contains `apiKey` or `plannerApiKey`, those values should be removed manually and the key should be provided via `MCBOT_AI_API_KEY` or a fresh runtime-only configure call.
