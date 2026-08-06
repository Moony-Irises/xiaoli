---
type: fix
scope: runtime
audience: developer
summary: Preserve and normalize default chat listener special replies
breaking: false
demo_ready: false
tests:
  - cmd /c npm run build
artifacts:
  - src/tools/action-tools.ts
  - docs/manual-testing-guide.md
---

## What changed

`applyPersistedChatConfig()` now preserves default `specialReplies` when older persisted chat config files do not contain a `specialReplies` field. Special reply matching also falls back to normalized text for includes rules, so spacing or punctuation like `hi 小狸` can still match `hi小狸`. The manual testing guide now documents that `hi小狸 -> hihi` belongs to `chat.listener.configure`, not `agent.configure`.

## Why it matters

Older local `chat-configs.json` files could accidentally wipe default hard-coded replies on load, making it look like the fixed reply behavior had been deleted. Small chat formatting differences could also make the intended fixed reply miss.

## Demo posture / limitations

This restores default handling for missing persisted fields. If a config explicitly sets `specialReplies` to an empty array, that still intentionally disables special replies.
