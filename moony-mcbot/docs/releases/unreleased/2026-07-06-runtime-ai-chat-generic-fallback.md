---
type: fix
scope: runtime
audience: developer
summary: AI chat now sends a short local fallback when upstream model calls fail.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
---

## What changed

When upstream AI chat fails, XiaoLi now sends a short local fallback message: `什么？`. Self-description prompts keep their slightly more specific local fallback.

## Why it matters

Temporary provider failures should look like an in-character confused response instead of silent failure.

## Demo posture / limitations

This only covers chat fallback behavior. It does not retry another provider or guarantee upstream availability.
