---
type: refactor
scope: runtime
audience: developer
summary: 将 chat.sendVerified 的服务器回显等待迁移到 ClientAdapter
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

Added `waitForChatEcho` to the shared ClientAdapter contract. Mineflayer keeps the existing `chat` and `messagestr` matching behavior with timeout cleanup, while `chat.sendVerified` now uses Runtime/Adapter APIs and no longer accesses the native bot directly.

## Why it matters

Chat verification is now an adapter capability rather than a Mineflayer-specific tool implementation. A future Modded Client bridge can provide its own server-echo or chat-event mapping without changing the MCP tool contract.

## Demo posture / limitations

The Mineflayer implementation is unchanged in behavior and still requires a real server echo for `echoed=true`. The conformance test only verifies the disconnected false path; a live server test remains in the manual testing backlog.
