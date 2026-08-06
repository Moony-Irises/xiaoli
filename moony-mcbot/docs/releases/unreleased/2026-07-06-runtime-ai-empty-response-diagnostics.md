---
type: fix
scope: runtime
audience: developer
summary: Improve diagnostics for empty AI chat and planner responses
breaking: false
demo_ready: true
tests: cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - docs/manual-testing-guide.md
---

## What changed

AI chat and planner response parsing now accepts string content, array text parts, and choice-level text. When the response is still empty, the error includes diagnostic details such as finish reason, message keys, content type, and whether reasoning content was present.

## Why it matters

Some OpenAI-compatible gateways can return an empty `message.content` while still including other fields. The previous error made this indistinguishable from a silent model failure.

## Demo posture / limitations

The runtime still does not speak reasoning-only output into Minecraft chat. If a provider returns only reasoning content, the correct fix is to use a model or provider setting that returns normal assistant content.
