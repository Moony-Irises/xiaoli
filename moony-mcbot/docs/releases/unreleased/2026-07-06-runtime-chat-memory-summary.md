---
type: feature
scope: runtime
audience: developer
summary: Whitelisted chat can now roll into shared McBot memory summaries every 20 entries.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/memory/chat-memory.ts
  - src/tools/action-tools.ts
  - README.md
---

## What changed

Added a shared chat-memory buffer for whitelisted Minecraft chat. Short-term pending entries are persisted in `C:\xiaoli\memory\chat-summary-state.json`; every 20 entries are summarized into `chat-summaries.jsonl` and appended to `episodes.jsonl` with `source: "McBot"`.

## Why it matters

XiaoLi can start carrying conversational continuity without stuffing raw chat logs into long-term memory. Later chat AI prompts read the summarized rolling memory, not the pending raw buffer.

## Demo posture / limitations

This is a local memory prototype. Pending unsummarized chat is stored only until it reaches the summary threshold; long-term behavior should rely on the generated summaries, and sensitive content still should not be sent in chat.
