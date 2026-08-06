---
type: refactor
scope: runtime
audience: developer
summary: Inventory hold actions now route through the client adapter.
breaking: false
demo_ready: true
tests:
  - cmd /c npm run build
artifacts:
  - src/runtime/client-adapter.ts
  - src/runtime/mineflayer-adapter.ts
  - src/runtime/bot-runtime.ts
  - src/tools/action-tools.ts
  - README.md
  - TODO.md
  - docs/releases/unreleased/2026-07-06-runtime-adapter-inventory-hold.md
---

## What changed

Added adapter-level `holdHotbarSlot` and `holdItemByCategory` actions, with `BotRuntime` wrappers. The public `inventory.holdSlot` and `inventory.holdByCategory` tools now call the runtime adapter path instead of directly selecting slots or equipping items from `action-tools.ts`.

## Why it matters

Hand selection is a common low-level capability shared by combat prep, food restocking, tool use, and future modded-client control. Moving it into the adapter keeps the public MCP contract stable while reducing direct mineflayer coupling in the tool layer.

## Demo posture / limitations

This does not change the external tool inputs or outputs in a breaking way. Hotbar organization, armor equip, container slot movement, and some combat loops still use mineflayer-specific inventory details and will need separate migrations.
