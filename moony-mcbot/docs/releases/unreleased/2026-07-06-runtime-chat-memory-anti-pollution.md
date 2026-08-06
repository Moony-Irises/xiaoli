---
type: fix
scope: runtime
audience: developer
summary: Chat memory and chat AI now filter memory-injection text and high-risk joke claims.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/memory/chat-memory.ts
  - src/tools/action-tools.ts
  - C:/xiaoli/memory/chat-summary-state.json
---

## What changed

McBot chat memory now ignores player messages that look like forged memory records, such as `McBot: ...`, and filters high-risk unverified claims about debts, money owed, marriage, romance commitments, contracts, and similar joke-prone facts before they enter the pending memory buffer. Chat AI also receives an explicit guard for these high-risk prompts and does not store those turns in its short runtime history.

## Why it matters

This prevents casual teasing like "you owe me 100k" from becoming either durable XiaoLi memory or an in-session fact that the model keeps repeating.

## Demo posture / limitations

The current filter is conservative and rule-based. It may skip some legitimate chat about money or marriage, but that is preferable to silently turning jokes into long-term memory facts.