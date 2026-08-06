---
type: fix
scope: runtime
audience: developer
summary: Self-description prompts now have a local fallback when first-turn AI chat fails.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
---

## What changed

Added a small local fallback for self-description style prompts, such as asking XiaoLi to describe or evaluate herself. If the chat model fails on that turn, XiaoLi sends a short local response instead of silently producing only a fallback failure log.

## Why it matters

Provider cold starts or first-turn response quirks should not make the bot appear unresponsive during a common smoke test prompt.

## Demo posture / limitations

This does not replace the AI chat path. It only covers a narrow self-description fallback and adds safer diagnostics for future AI chat failures.
