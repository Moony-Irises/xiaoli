---
type: refactor
scope: runtime
audience: developer
summary: 通过 Client Adapter Factory 创建 Mineflayer 适配器
breaking: false
demo_ready: false
tests: npm run typecheck; npm test; git diff --check
artifacts:
  - src/runtime/client-adapter-factory.ts
  - src/runtime/client-adapter.ts
  - src/runtime/bot-runtime.ts
  - test/client-adapter-factory.test.ts
---

## What changed

Added a `ClientAdapter` factory and changed `BotRuntime` to create its default Mineflayer adapter through that factory. The shared adapter contract now includes the lifecycle synchronization methods already required by `BotRuntime`. Selecting `modded-client` fails explicitly because the bridge is not implemented yet.

## Why it matters

The runtime no longer hard-codes the concrete adapter construction site. Future companion-mod or local-bridge support can register a new adapter without rewriting the connection lifecycle or action dispatch surface.

## Demo posture / limitations

This is an internal factory boundary only. Existing bots still use Mineflayer exactly as before, no new adapter configuration field is exposed, and no Forge/Fabric/NeoForge client bridge is included. The next adapter step is to remove native Mineflayer exposure from the shared interface and add conformance tests.
