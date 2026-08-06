---
type: refactor
scope: runtime
audience: developer
summary: 将普通聊天攻击的目标识别与近距离单次攻击迁移到 ClientAdapter
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

Chat attack intents now identify visible player targets from adapter snapshots, equip a sword or axe through runtime actions when available, and perform nearby one-hit attacks through `attackPlayer` or `attackNearestEntity`. A pure target parser prevents an explicitly named but invisible player from falling through to an unrelated entity attack.

## Why it matters

Ordinary chat attacks now produce unified adapter action evidence and no longer depend on Mineflayer entity handles for nearby targeting or attack execution. The invisible-target guard also keeps a failed player command from causing an unintended attack.

## Demo posture / limitations

This is an internal migration, not Modded Client support or a published demo. Approaching a distant player still uses Mineflayer pathfinder compatibility code. Sustained challenge sessions, combat loops and hotbar organization remain Mineflayer-specific and are not represented as completed Adapter capabilities by this change.
