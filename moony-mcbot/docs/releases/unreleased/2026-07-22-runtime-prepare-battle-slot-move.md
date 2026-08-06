---
type: fix
scope: runtime
audience: developer
summary: 修复准备战斗按旧回调形式调用 Promise 式槽位移动导致的等待问题
breaking: false
demo_ready: false
tests: npx tsx --test test/mineflayer-inventory.test.ts test/hotbar-organization.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/mineflayer-inventory.ts
  - src/runtime/mineflayer-adapter.ts
  - src/tools/action-tools.ts
  - test/mineflayer-inventory.test.ts
  - docs/manual-testing-guide.md
---

## What changed

Replaced the legacy callback wrapper around Mineflayer `moveSlotItem` with a typed Promise adapter. The iron-sword preparation path and Adapter hotbar organizer now share it. The iron-sword flow was extracted and tested for occupied targets, already-correct placement, full inventory and rejected moves.

## Why it matters

Mineflayer 4.33 exposes `moveSlotItem` as `Promise<void>`. Passing an ignored callback could leave the old wrapper waiting forever, so `combat.prepareBattle` could appear to hang while moving an iron sword. The new path awaits the actual operation and propagates failures into the existing best-weapon fallback.

## Demo posture / limitations

This fixes the slot-move contract but does not migrate all combat preparation into ClientAdapter, start a duel, or add Modded Client support. Armor selection and the fallback weapon behavior remain unchanged and still need an in-game regression pass.
