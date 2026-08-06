---
type: fix
scope: runtime
audience: developer
summary: Deduplicated duplicate chat and messagestr events before replies, memory, and Agent event recording.
breaking: false
demo_ready: false
tests:
  - git diff --check
  - npm run build
  - npm run typecheck
  - npm test
artifacts:
  - src/runtime/chat-event-dedup.ts
  - src/tools/action-tools.ts
  - test/chat-event-dedup.test.ts
  - package.json
  - README.md
  - TODO.md
  - docs/architecture-convergence-roadmap.md
  - docs/manual-testing-guide.md
  - docs/releases/unreleased/2026-07-21-runtime-chat-event-dedup.md
---

## What changed

The chat listener now deduplicates the same bot, sender, and normalized message within a 1.5 second window. The guard runs before shared memory, valid-chat logging, Agent events, fixed replies, intent actions, and AI chat. Its state is cleared when the bot listener is detached or replaced.

## Why it matters

Mineflayer can expose one in-game message through both `chat` and `messagestr`. Without a boundary, one command could trigger two replies, two actions, and two memory records. The deduplicator keeps the existing response behavior while making the event boundary deterministic.

## Demo posture / limitations

This protects duplicate delivery from the two listener events. It does not yet provide a full message ID from the server, and the final behavior still needs in-game verification with a real bot and chat listener enabled.
