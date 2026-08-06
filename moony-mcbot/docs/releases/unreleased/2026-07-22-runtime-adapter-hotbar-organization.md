---
type: refactor
scope: runtime
audience: developer
summary: 将快捷栏整理迁移到可测试的 ClientAdapter 能力
breaking: false
demo_ready: false
tests: npx tsx --test test/hotbar-organization.test.ts test/client-adapter-conformance.test.ts test/client-adapter-status.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/hotbar-organization.ts
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - test/hotbar-organization.test.ts
  - test/client-adapter-conformance.test.ts
  - test/client-adapter-status.test.ts
---

## What changed

Added an `organize_hotbar` ClientAdapter capability. A pure planner selects the best sword, axe, pickaxe and food, reserves hotbar slots 1/2/3/9, and emits safe slot moves without overwriting occupied targets. MineflayerAdapter executes that plan through the current Promise-based slot API, while chat, Agent executor and MCP entry points now share the runtime method.

## Why it matters

Hotbar policy is now independently testable and its execution produces Adapter action evidence. The planner explicitly represents missing categories and full-inventory blocking, so partial organization remains observable instead of silently losing items.

## Demo posture / limitations

This is an internal migration and is not Modded Client support, a published install demo or GA behavior. The fixed four-category policy is unchanged. Container GUIs, arbitrary inventory layouts, sustained combat and the separate prepare-battle slot path remain outside this change.
