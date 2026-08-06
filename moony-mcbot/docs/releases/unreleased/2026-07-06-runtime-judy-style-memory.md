---
type: feature
scope: runtime
audience: developer
summary: Chat memory summaries can now capture Judy's stable communication habits as light context.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/memory/chat-memory.ts
---

## What changed

The chat-memory summarizer now treats stable player communication habits as valid summary material. For Judy, it can capture preferred nicknames, common tone, interaction style, and how she usually asks XiaoLi for things.

## Why it matters

XiaoLi can gradually respond with better local context for Judy without copying Judy's personality. The generated prompt explicitly keeps XiaoLi's cool, short-spoken persona as the higher-priority style.

## Demo posture / limitations

This is a soft style hint, not a full user-modeling system. It should help with rhythm and preferences, but it should not be used to infer sensitive facts or imitate Judy directly.
