---
type: refactor
scope: runtime
audience: developer
summary: 将聊天监听迁移到 ClientAdapter 统一事件订阅
breaking: false
demo_ready: false
tests: npm run typecheck; npm test; git diff --check
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/runtime/mineflayer-adapter.ts
  - src/tools/action-tools.ts
  - test/client-adapter-conformance.test.ts
---

## What changed

Added `subscribeChatEvents` to the ClientAdapter contract. Mineflayer normalizes `chat` and parsed `messagestr` events, owns listener cleanup, and exposes an unsubscribe function. The chat listener now consumes normalized events while retaining whitelist, wake-word, deduplication, memory, and response logic.

## Why it matters

Chat input is now an adapter boundary rather than a direct Mineflayer event dependency in `action-tools.ts`. Reconnect cleanup is owned by the adapter, and the watchdog re-subscribes after a new connection instead of treating a stale runtime record as an active listener.

## Demo posture / limitations

The listener transport is abstracted, but some chat intents still use Mineflayer-specific entity or inventory operations when executing challenge, attack, organize, and mining behavior. This change does not add Modded Client support or change the external chat tool names.
