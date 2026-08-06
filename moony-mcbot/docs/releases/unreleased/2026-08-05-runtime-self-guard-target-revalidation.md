---
type: refactor
scope: runtime
audience: developer
summary: Self-guard 持续与短反击改用 Adapter 快照复核同名目标和精确距离
breaking: false
demo_ready: false
tests:
  - npx tsx --test --import ./scripts/test-setup.ts test/self-guard-retaliation.test.ts test/self-guard-environment.test.ts test/combat-execution-state-store.test.ts test/self-guard-runtime-state-store.test.ts test/retaliation-state-store.test.ts test/self-guard-loop-lifecycle.test.ts test/self-guard-hurt-subscriptions.test.ts test/self-guard-config-store.test.ts
  - npm run validate:releases
  - npm run lint
  - npm run typecheck
  - npm test
  - npm run build
artifacts:
  - src/runtime/self-guard-retaliation.ts
  - src/runtime/README.md
  - src/tools/action-tools.ts
  - test/self-guard-retaliation.test.ts
  - src/config/README.md
  - docs/persistence-lifecycle-design.md
  - docs/architecture-convergence-roadmap.md
  - docs/project-audit-2026-07-31.md
  - docs/manual-testing-guide.md
  - README.md
  - CLAUDE.md
  - TODO.md
---

## What changed

新增纯 `resolveRetaliationTarget`，要求玩家快照与 session 目标用户名精确一致，并根据当前自身和目标坐标重新计算三维距离。持续反击 tick 与短反击的每次命中现在先读取 Adapter 快照完成复核，再进入既有 Mineflayer 寻路、注视和攻击边界。

## Why it matters

反击任务不再用原生 `bot.players` 和实体坐标承担目标存在性及距离判断，损坏或消失的快照会 fail-closed。远距离目标仍可沿用原追击语义，攻击距离、节奏、命中次数、60 秒超时和结束汇报均保持不变。

## Demo posture / limitations

本轮不是 install demo、尚未发布，也不是 GA。它不新增 MCP/Web 工具、配置字段或 Adapter capability，不改变反击聊天文本，也不代表真实服务器行为已经回归。`entityHurt` 仍没有真实伤害来源；追击、控制状态、装备、跳击和攻击仍依赖 Mineflayer 原生实体。
