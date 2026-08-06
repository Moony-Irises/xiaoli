---
type: feature
scope: runtime
audience: developer
summary: Add environment defaults for the default bot chat listener
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - .env.local.example
  - README.md
  - docs/manual-testing-guide.md
---

## What changed

Added opt-in environment defaults for the default bot chat listener:

- `MCBOT_DEFAULT_CHAT_LISTENER_ENABLED`
- `MCBOT_DEFAULT_CHAT_WHITELIST`
- `MCBOT_DEFAULT_CHAT_WAKE_NAMES`
- `MCBOT_DEFAULT_CHAT_HI_REPLY`

The local env example and manual testing guide now show how to make `hi小狸 -> hihi` work immediately after startup.

## Why it matters

Fixed game-chat replies were easy to forget because `agent.configure` does not enable `chat.listener`. Local testing can now enable the listener from `.env.local` without retyping `chat.listener.configure` in an MCP client.

## Demo posture / limitations

This only configures the default bot at startup. Runtime `chat.listener.configure` can still override the listener, and explicitly persisted empty `specialReplies` still intentionally disables fixed replies.
