---
type: fix
scope: runtime
audience: developer
summary: Chat AI now has a runtime style guard against flattering or customer-service-like replies.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - docs/releases/unreleased/2026-07-06-runtime-chat-ai-anti-flattery-guard.md
---

## What changed

Added a fixed runtime style guard to the in-game chat AI request. It tells the model not to flatter Judy, not to act eager to please, not to sound like customer support, and to keep XiaoLi's replies short, dry, mildly aloof, and natural.

## Why it matters

The editable prompt profile and rolling chat memory can drift warm because Judy is both owner and trusted player. This guard gives every chat AI call a stable correction layer so XiaoLi keeps the intended cool style even when memory summaries or model priors push toward over-friendly replies.

## Demo posture / limitations

This only changes AI small-talk prompting. It does not force exact wording, and local provider behavior can still vary. If a running process already loaded old code, restart the bot service before testing.
