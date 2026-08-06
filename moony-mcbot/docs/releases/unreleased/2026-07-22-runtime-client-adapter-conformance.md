---
type: test
scope: runtime
audience: developer
summary: 移除 ClientAdapter 原生句柄并增加离线契约测试
breaking: false
demo_ready: false
tests: npm run typecheck; npm test; git diff --check
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/bot-runtime.ts
  - test/client-adapter-conformance.test.ts
  - test/client-adapter-factory.test.ts
---

## What changed

The shared `ClientAdapter` contract no longer exposes native Mineflayer bot handles. `BotRuntime` keeps a clearly isolated compatibility seam for legacy high-level calls, while the new offline conformance test verifies the unified adapter methods, capabilities, connection state, and disconnected snapshots.

## Why it matters

Future adapters can implement the same capability contract without pretending to provide a Mineflayer object. The conformance test gives the Modded Client adapter a concrete baseline before any bridge code is written.

## Demo posture / limitations

This does not add Modded Client support. Existing Mineflayer behavior remains unchanged, and `BotRuntime.getActiveBotOrThrow()` is still available for legacy tool code. That compatibility seam must be removed after high-level actions finish migrating to adapter capabilities.
