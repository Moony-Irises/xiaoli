---
type: fix
scope: runtime
audience: developer
summary: Judy chat memory now emphasizes communication style over invented personality judgments.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/memory/chat-memory.ts
  - C:/Users/Moony/AppData/Local/moony-mcbot/config/prompt-profile.json
  - C:/xiaoli/memory/chat-summary-state.json
---

## What changed

The chat-memory summarizer now asks for a clearer rolling summary shape: Judy style, stable facts, and reply guidance. The prompt emphasizes learning Judy's rhythm and preferences without copying her wording or inventing XiaoLi's inner feelings.

## Why it matters

This should make XiaoLi feel less like a hand-written rule sheet and more like a character that adapts to Judy's conversational habits while keeping her own cool, short-spoken voice.

## Demo posture / limitations

This is still summary-driven style learning. It depends on enough real Judy chat examples and does not yet maintain a structured per-player style profile.
