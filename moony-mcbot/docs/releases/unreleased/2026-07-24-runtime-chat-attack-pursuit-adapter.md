---
type: refactor
scope: runtime
audience: developer
summary: 将聊天中远距离明确玩家攻击的靠近动作迁移到稳定实体 ID 的 Adapter 追击
breaking: false
demo_ready: false
tests: npx tsx --test test/chat-attack-target.test.ts; npm run typecheck; npm run build; npm test; git diff --check
artifacts:
  - src/runtime/chat-attack-target.ts
  - src/tools/action-tools.ts
  - test/chat-attack-target.test.ts
  - docs/manual-testing-guide.md
---

## What changed

Remote player attack intent now uses a pure decision helper to distinguish unavailable, in-range one-hit and out-of-range approach cases. The approach branch calls `runtime.pursueEntity` with the matched player's stable entity ID instead of accessing the native Mineflayer bot and pathfinder.

## Why it matters

Chat attack orchestration no longer leaks Mineflayer pathfinding details, and Adapter action history now shows the remote approach attempt. The explicit-player guard remains intact, so an unavailable named player cannot fall through to a nearby mob.

## Demo posture / limitations

This preserves the existing behavior: a remote attack instruction only approaches and reports; it does not automatically attack after reaching the player. This is an internal refactor, not Modded Client support, an install demo, a published release or GA behavior, and it still needs the documented in-game regression pass.
